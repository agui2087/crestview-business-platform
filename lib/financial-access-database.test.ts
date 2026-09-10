import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL execution, not mocked Supabase success objects. Auth/storage
// scaffolding replaces hosted services; table definitions and guards are real.
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const buyer = "00000000-0000-4000-8000-000000000001";
const broker = "00000000-0000-4000-8000-000000000002";
const outsider = "00000000-0000-4000-8000-000000000003";
const deal = "00000000-0000-4000-8000-000000000004";
const listing = "00000000-0000-4000-8000-000000000005";

test("financial access transaction, authorization, stale writes and rollback", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql as
        $$ select current_setting('request.jwt.claim.role',true) $$;
      grant usage on schema auth to authenticated, anon;
      create table public.profiles(user_id uuid primary key, display_name text, locale text);
    `);
    await db.exec(await migration("0011_marketplace_workspaces"));
    const financial = await migration("0012_automated_nda_and_financial_access");
    await db.exec(financial.slice(0, financial.indexOf("insert into storage.buckets")));
    const trust = await migration("0013_marketplace_trust_and_profiles");
    await db.exec(trust.slice(trust.indexOf("create table if not exists public.marketplace_audit_events"), trust.indexOf("create table if not exists public.marketplace_reports")));
    await db.exec("alter table public.marketplace_audit_events enable row level security; grant select, insert on public.marketplace_audit_events to authenticated;");
    const guards = await migration("0022_database_authorization_hardening");
    await db.exec(guards.slice(0, guards.indexOf('drop policy if exists "buyers create inquiries"')));
    await db.exec(guards.slice(guards.indexOf('drop policy if exists "participants create notifications"'), guards.indexOf('drop policy if exists "users create reports"')));
    await db.exec(await migration("0027_atomic_financial_access"));
    await db.exec(`
      select set_config('request.jwt.claim.role','service_role',false);
      insert into auth.users values ('${buyer}'),('${broker}'),('${outsider}');
      insert into marketplace_listings(id,broker_id,title,summary,industry,city,state_code,status)
        values ('${listing}','${broker}','Test','Test','Test','Test','CA','published');
      insert into deal_inquiries(id,listing_id,buyer_id,broker_id,subject,initial_message,status)
        values ('${deal}','${listing}','${buyer}','${broker}','Test','Test','nda_signed');
      insert into deal_ndas(inquiry_id,buyer_id,broker_id,document_name,status)
        values ('${deal}','${buyer}','${broker}','Test','signed');
    `);
    const snapshot = async () => {
      await db.exec("reset role");
      return (await db.query<{ inquiry: { status: string; financial_access_status: string }; notifications: number; events: number; audits: number }>(`select row_to_json(i) inquiry,
        (select count(*)::int from marketplace_notifications) notifications,
        (select count(*)::int from deal_status_events) events,
        (select count(*)::int from marketplace_audit_events) audits
        from deal_inquiries i where id='${deal}'`)).rows[0];
    };
    const version = async () => {
      await db.exec("reset role");
      return (await db.query<{version: string}>(`select updated_at::text version from deal_inquiries where id='${deal}'`)).rows[0].version;
    };
    const call = async (actor: string, action: string, expected = "", message = "Please share the financial records.") => {
      const stamp = expected || await version();
      await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [actor]);
      await db.exec("set role authenticated");
      return db.query("select change_deal_financial_access($1,$2,$3,$4,'90 days','Ready',array['Financial statements'],'en')", [deal, action, stamp, message]);
    };
    await t.test("outsider, buyer approval and invalid input leave no writes", async () => {
      const before = await snapshot();
      await assert.rejects(call("", "requested"));
      await assert.rejects(call(outsider, "requested"));
      await assert.rejects(call(broker, "requested"));
      await assert.rejects(call(buyer, "approved"));
      await assert.rejects(call(buyer, "requested", "", "short"));
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("request notification failure rolls back the request itself", async () => {
      await db.exec("reset role; alter table marketplace_notifications add constraint injected_request_failure check (kind <> 'financial_request')");
      const before = await snapshot();
      await assert.rejects(call(buyer, "requested"));
      assert.deepEqual(await snapshot(), before);
      await db.exec("alter table marketplace_notifications drop constraint injected_request_failure");
    });
    await t.test("request writes all four records once; replay fails", async () => {
      const stamp = await version();
      await call(buyer, "requested", stamp);
      const saved = await snapshot();
      assert.equal(saved.notifications, 1);
      assert.equal(saved.events, 1);
      assert.equal(saved.audits, 1);
      await assert.rejects(call(buyer, "requested", stamp));
      assert.deepEqual(await snapshot(), saved);
    });
    await t.test("broker cannot act on a version older than the buyer request", async () => {
      const before = await snapshot();
      await assert.rejects(call(broker, "approved", "2020-01-01T00:00:00Z"));
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("status event failure rolls back decision and notification", async () => {
      await db.exec("reset role; alter table deal_status_events add constraint injected_status_failure check (to_status <> 'document_review')");
      const before = await snapshot();
      await assert.rejects(call(broker, "approved"));
      assert.deepEqual(await snapshot(), before);
      await db.exec("alter table deal_status_events drop constraint injected_status_failure");
    });
    await t.test("failure in final audit insert rolls back update and earlier inserts", async () => {
      await db.exec("reset role; alter table marketplace_audit_events add constraint injected_failure check (event_type <> 'financial_access_decided')");
      const before = await snapshot();
      await assert.rejects(call(broker, "approved"));
      assert.deepEqual(await snapshot(), before);
      await db.exec("alter table marketplace_audit_events drop constraint injected_failure");
    });
    await t.test("approval preserves offer stage and writes complete evidence", async () => {
      await db.exec(`reset role; select set_config('request.jwt.claim.role','service_role',false); update deal_inquiries set status='offer' where id='${deal}'`);
      await call(broker, "approved");
      const saved = await snapshot();
      assert.equal((saved.inquiry as {status: string}).status, "offer");
      assert.equal((saved.inquiry as {financial_access_status: string}).financial_access_status, "approved");
      assert.equal(saved.audits, 2);
      await assert.rejects(call(buyer, "requested"));
      assert.deepEqual(await snapshot(), saved);
    });
    await t.test("missing NDA blocks broker decision", async () => {
      await db.exec(`reset role; select set_config('request.jwt.claim.role','service_role',false); update deal_inquiries set financial_access_status='requested' where id='${deal}'; update deal_ndas set status='superseded'`);
      const before = await snapshot();
      await assert.rejects(call(broker, "approved"));
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("request-more-information permits a new buyer request then approval", async () => {
      await db.exec("reset role; select set_config('request.jwt.claim.role','service_role',false); update deal_ndas set status='signed'");
      await call(broker, "more_information");
      await call(buyer, "requested");
      await call(broker, "approved");
      const saved = await snapshot();
      assert.equal(saved.inquiry.financial_access_status, "approved");
      await assert.rejects(call(broker, "declined"));
      assert.deepEqual(await snapshot(), saved);
    });
  } finally {
    await db.close();
  }
});
