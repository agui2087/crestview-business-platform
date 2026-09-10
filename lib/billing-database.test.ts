import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const user = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

// Execute the deployed migration in isolated PostgreSQL. No Stripe calls,
// customer records, hosted credentials, or production database writes.
test("billing transaction and access-control regression coverage", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${user}'),('${other}');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/0010_stripe_billing.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/0028_checkout_fulfillment_identity.sql", import.meta.url), "utf8"));
    const clear = () => db.exec("reset role; truncate stripe_checkout_fulfillments, billing_entitlements, billing_subscriptions, billing_customers, stripe_webhook_events");
    const fulfill = async (event: string, session = "cs_fixture", owner = user, quantity = 1) => {
      await db.exec("set role service_role");
      return (await db.query<{applied:boolean}>(`select fulfill_stripe_checkout_payment(
        $1,$2,'checkout.session.completed',$3,'cus_fixture','single_listing','price_fixture',$4,null
      ) applied`, [session,event,owner,quantity])).rows[0].applied;
    };
    const apply = async (id: string, operation = "increment", product = "single_listing", subscription: string | null = null, status = "active", active = true) => {
      await db.exec("set role service_role");
      return (await db.query<{ applied: boolean }>(`select apply_stripe_billing_event(
        p_event_id => $1, p_event_type => $2, p_user_id => $3,
        p_customer_id => 'cus_fixture', p_subscription_id => $4,
        p_product_code => $5, p_price_id => 'price_fixture', p_status => $6,
        p_entitlement_active => $7, p_entitlement_operation => $8
      ) applied`, [id, subscription ? "customer.subscription.updated" : "checkout.session.completed", user, subscription, product, status, active, operation])).rows[0].applied;
    };
    const snapshot = async () => {
      await db.exec("reset role");
      return (await db.query(`select
        (select coalesce(jsonb_agg(to_jsonb(x) order by checkout_session_id),'[]') from stripe_checkout_fulfillments x) fulfillments,
        (select coalesce(jsonb_agg(to_jsonb(x) order by stripe_event_id),'[]') from stripe_webhook_events x) events,
        (select coalesce(jsonb_agg(to_jsonb(x) order by user_id),'[]') from billing_customers x) customers,
        (select coalesce(jsonb_agg(to_jsonb(x) order by stripe_subscription_id),'[]') from billing_subscriptions x) subscriptions,
        (select coalesce(jsonb_agg(to_jsonb(x) order by user_id,product_code),'[]') from billing_entitlements x) entitlements`)).rows[0];
    };
    await t.test("same event is applied once and its replay changes nothing", async () => {
      await clear();
      assert.equal(await apply("evt_once"), true);
      const before = await snapshot();
      assert.equal(await apply("evt_once"), false);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("independent paid events each add one credit", async () => {
      await clear();
      await apply("evt_one"); await apply("evt_two");
      await db.exec("reset role");
      assert.equal((await db.query<{quantity:number}>("select quantity from billing_entitlements")).rows[0].quantity, 2);
    });
    await t.test("failure on final entitlement write rolls back event, customer and subscription; retry succeeds", async () => {
      await clear();
      await db.exec("alter table billing_entitlements add constraint injected_failure check (product_code <> 'crestview_pro')");
      const before = await snapshot();
      await assert.rejects(apply("evt_retry", "set", "crestview_pro", "sub_fixture"));
      assert.deepEqual(await snapshot(), before);
      await db.exec("alter table billing_entitlements drop constraint injected_failure");
      assert.equal(await apply("evt_retry", "set", "crestview_pro", "sub_fixture"), true);
    });
    await t.test("unsupported operation leaves no event receipt or customer write", async () => {
      await clear();
      const before = await snapshot();
      await assert.rejects(apply("evt_invalid", "unsupported"));
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("authenticated and anonymous roles cannot execute privileged billing mutation", async () => {
      await clear();
      for (const role of ["authenticated", "anon"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(db.query("select apply_stripe_billing_event('evt_denied','test')"), { code: "42501" });
      }
      await db.exec("reset role");
      assert.equal((await db.query<{count:number}>("select count(*)::int count from stripe_webhook_events")).rows[0].count, 0);
    });
    await t.test("users can read only their own entitlements and cannot edit them", async () => {
      await clear(); await apply("evt_rls");
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
      await db.exec("set role authenticated");
      assert.equal((await db.query("select * from billing_entitlements")).rows.length, 0);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      assert.equal((await db.query("select * from billing_entitlements")).rows.length, 1);
      await assert.rejects(db.query("update billing_entitlements set quantity=100"), { code: "42501" });
    });
    await t.test("current limitation: a late active snapshot overwrites cancellation", async () => {
      await clear();
      await apply("evt_new_cancel", "set", "crestview_pro", "sub_fixture", "canceled", false);
      await apply("evt_old_active", "set", "crestview_pro", "sub_fixture", "active", true);
      await db.exec("reset role");
      // Diagnostic of existing behavior, NOT acceptance of this as safe.
      // Replace with a rejection/current-state assertion when ordering is fixed.
      assert.equal((await db.query<{status:string}>("select status from billing_subscriptions")).rows[0].status, "active");
      assert.equal((await db.query<{active:boolean}>("select active from billing_entitlements")).rows[0].active, true);
    });
    await t.test("distinct event IDs for the same Checkout session grant only one credit", async () => {
      await clear();
      assert.equal(await fulfill("evt_first"), true);
      assert.equal(await fulfill("evt_second"), false);
      assert.equal(await fulfill("evt_first"), false);
      await db.exec("reset role");
      assert.equal((await db.query<{quantity:number}>("select quantity from billing_entitlements")).rows[0].quantity, 1);
      assert.equal((await db.query<{count:number}>("select count(*)::int count from stripe_webhook_events")).rows[0].count, 2);
    });
    await t.test("a different paid session grants its own credit", async () => {
      await clear();
      await fulfill("evt_first", "cs_first");
      await fulfill("evt_second", "cs_second");
      await db.exec("reset role");
      assert.equal((await db.query<{quantity:number}>("select quantity from billing_entitlements")).rows[0].quantity, 2);
    });
    await t.test("failed fulfillment rolls back its session receipt so retry can succeed", async () => {
      await clear();
      await db.exec("alter table billing_entitlements add constraint injected_failure check (product_code <> 'single_listing')");
      const before = await snapshot();
      await assert.rejects(fulfill("evt_retry"));
      assert.deepEqual(await snapshot(), before);
      await db.exec("alter table billing_entitlements drop constraint injected_failure");
      assert.equal(await fulfill("evt_retry"), true);
    });
    await t.test("session identity mismatch and invalid quantity cannot grant credits", async () => {
      await clear(); await fulfill("evt_first");
      const before = await snapshot();
      await assert.rejects(fulfill("evt_wrong", "cs_fixture", other), { code: "22023" });
      await assert.rejects(fulfill("evt_quantity", "cs_second", user, 2), { code: "22023" });
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("new fulfillment endpoint and receipts remain inaccessible to browser roles", async () => {
      await clear();
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(db.query(`select fulfill_stripe_checkout_payment(
          'cs_denied','evt_denied','checkout.session.completed',$1,'cus_fixture','single_listing','price_fixture',1,null
        )`, [user]), { code: "42501" });
        await assert.rejects(db.query("select * from stripe_checkout_fulfillments"), { code: "42501" });
      }
    });
  } finally {
    await db.close();
  }
});
