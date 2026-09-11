import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner="00000000-0000-4000-8000-000000000001";
const stranger="00000000-0000-4000-8000-000000000002";
test("ordered subscription fulfillment and access projection",async(t)=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${owner}'),('${stranger}');`);
    for(const name of ["0010_stripe_billing.sql","0043_ordered_subscription_fulfillment.sql"])
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8"));
    const clear=()=>db.exec("reset role; truncate billing_complimentary_grants,billing_entitlements,billing_subscriptions,billing_customers,stripe_webhook_events");
    const apply=async(id:string,time:number,status="active",sub="sub_fixture",user=owner,customer="cus_fixture",quantity=1,product="broker_plan")=>{
      await db.exec("set role service_role");
      return (await db.query<{applied:boolean}>(`select public.apply_stripe_subscription_event(
        $1,'customer.subscription.updated',$2,$3,$4,$5,$6,'price_fixture',$7,$8,now()+interval '30 days',false) applied`,
        [id,time,user,customer,sub,product,status,quantity])).rows[0].applied;
    };
    const state=async()=>{
      await db.exec("reset role");
      return (await db.query<{status:string;active:boolean;quantity:number}>(`select s.status,e.active,e.quantity from billing_subscriptions s
        join billing_entitlements e using(user_id,product_code) where s.stripe_subscription_id='sub_fixture'`)).rows[0];
    };
    await t.test("paid active state grants access; exact replay changes nothing",async()=>{
      await clear();assert.equal(await apply("evt_once",100),true);
      assert.equal(await apply("evt_once",100),false);
      assert.deepEqual(await state(),{status:"active",active:true,quantity:1});
      assert.equal((await db.query<{n:number}>("select count(*)::int n from stripe_webhook_events")).rows[0].n,1);
    });
    await t.test("older active event cannot undo a newer unpaid state",async()=>{
      await clear();await apply("evt_new",200,"unpaid");
      assert.equal(await apply("evt_old",100),false);
      assert.deepEqual(await state(),{status:"unpaid",active:false,quantity:0});
    });
    await t.test("cancellation wins at the same timestamp and cannot be resurrected",async()=>{
      await clear();await apply("evt_active",200);
      assert.equal(await apply("evt_cancel",200,"canceled"),true);
      for(const time of [100,200,300])assert.equal(await apply(`evt_late_${time}`,time),false);
      assert.deepEqual(await state(),{status:"canceled",active:false,quantity:0});
    });
    await t.test("canceling an old subscription keeps a separate valid subscription active",async()=>{
      await clear();await apply("evt_one",100);await apply("evt_two",100,"active","sub_second");
      await apply("evt_cancel",200,"canceled");
      assert.deepEqual(await state(),{status:"canceled",active:true,quantity:1});
    });
    await t.test("customer or subscription identity cannot be reassigned",async()=>{
      await clear();await apply("evt_one",100);
      await assert.rejects(apply("evt_wrong_user",200,"active","sub_fixture",stranger),{code:"22023"});
      await assert.rejects(apply("evt_wrong_customer",200,"active","sub_fixture",owner,"cus_other"),{code:"22023"});
      assert.deepEqual(await state(),{status:"active",active:true,quantity:1});
    });
    await t.test("invalid quantities cannot activate subscriptions",async()=>{
      await clear();
      await assert.rejects(apply("evt_many",100,"active","sub_fixture",owner,"cus_fixture",2),{code:"22023"});
      await assert.rejects(apply("evt_tier",100,"active","sub_fixture",owner,"cus_fixture",11,"workforce"),{code:"22023"});
    });
    await t.test("entitlement failure rolls back event receipt and subscription so retry succeeds",async()=>{
      await clear();await db.exec("alter table billing_entitlements add constraint test_failure check(product_code<>'broker_plan')");
      await assert.rejects(apply("evt_retry",100));await db.exec("reset role");
      for(const table of ["stripe_webhook_events","billing_subscriptions","billing_customers"])
        assert.equal((await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n,0);
      await db.exec("alter table billing_entitlements drop constraint test_failure");
      assert.equal(await apply("evt_retry",100),true);
    });
    await t.test("an unexpired complimentary broker grant survives paid cancellation",async()=>{
      await clear();await db.query(`insert into billing_entitlements(user_id,product_code,active,quantity,expires_at,source_event_id)
        values($1,'broker_plan',true,1,now()+interval '90 days','broker-trial-code-v2:fixture')`,[owner]);
      await apply("evt_paid",100);await apply("evt_cancel",200,"canceled");
      assert.equal((await state()).active,true);
    });
    await t.test("browser roles cannot invoke fulfillment or read private grant records",async()=>{
      await clear();for(const role of ["anon","authenticated"]){
        await db.exec(`set role ${role}`);
        await assert.rejects(db.query("select apply_stripe_subscription_event(null,null,null,null,null,null,null,null,null,null,null,null)"),{code:"42501"});
        await assert.rejects(db.query("select * from billing_complimentary_grants"),{code:"42501"});
      }
    });
  } finally {await db.close();}
});
