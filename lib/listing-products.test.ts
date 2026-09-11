import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const listing='00000000-0000-4000-8000-000000000011';
test('listing-specific paid delivery, permissions and lifecycle',async t=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      insert into auth.users values('${owner}'),('${other}');
      create table marketplace_listings(id uuid primary key,broker_id uuid,status text,updated_at timestamptz default now());
      create table listing_nda_templates(listing_id uuid,broker_id uuid,broker_attested boolean,auto_send boolean,storage_path text,security_status text);`);
    for(const name of ['0010_stripe_billing.sql','0044_listing_product_delivery.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
    const reset=async()=>{await db.exec(`reset role;truncate listing_promotion_engagement,listing_product_orders,listing_payment_revocations,marketplace_listings,listing_nda_templates,billing_customers,billing_entitlements;
      insert into marketplace_listings(id,broker_id,status) values('${listing}','${owner}','draft');
      insert into listing_nda_templates values('${listing}','${owner}',true,true,'synthetic.pdf','malware_scanned');
      insert into billing_customers(user_id,stripe_customer_id) values('${owner}','cus_fixture');`);};
    const prepare=async(product='single_listing',user=owner)=>{await db.exec('set role service_role');return (await db.query<{id:string}>(`select (prepare_listing_product_order($1,$2,$3,'price_fixture','cus_fixture')).*`,[user,listing,product])).rows[0];};
    const deliver=async(id:string,event='evt_paid',session='cs_fixture')=>{await db.exec('set role service_role');return (await db.query<{ok:boolean}>(`select deliver_listing_product($1,$2,'pi_fixture',$3,$4,$5,'cus_fixture','single_listing','price_fixture') ok`,[id,session,event,owner,listing])).rows[0].ok;};
    await t.test('one draft, one purchase; repeated events do not grant extra licenses',async()=>{
      await reset();const o=await prepare();assert.equal((await prepare()).id,o.id);
      assert.equal(await deliver(o.id),true);assert.equal(await deliver(o.id,'evt_second'),false);
      await db.exec('reset role');assert.equal((await db.query<{n:number}>('select count(*)::int n from listing_product_orders')).rows[0].n,1);
      await assert.rejects(prepare());
    });
    await t.test('ownership, NDA and customer identity are checked before any purchase',async()=>{
      await reset();await assert.rejects(prepare('single_listing',other));
      await db.exec('reset role;update listing_nda_templates set broker_attested=false');await assert.rejects(prepare());
      await db.exec('reset role;update listing_nda_templates set broker_attested=true;delete from billing_customers');await assert.rejects(prepare());
    });
    await t.test('checkout and payment identity cannot be reassigned',async()=>{
      await reset();const o=await prepare();await db.query('select bind_listing_product_checkout($1,$2)',[o.id,'cs_fixture']);
      await assert.rejects(deliver(o.id,'evt_wrong','cs_other'));assert.equal(await deliver(o.id),true);
      await assert.rejects(deliver(o.id,'evt_wrong','cs_other'));
    });
    await t.test('failed delivery rolls back for retry; expired orders cannot be paid silently',async()=>{
      await reset();const o=await prepare();await db.exec("reset role;alter table listing_product_orders add constraint reject_test check(status<>'paid')");
      await assert.rejects(deliver(o.id));await db.exec('reset role;alter table listing_product_orders drop constraint reject_test');
      assert.equal(await deliver(o.id),true);
      await reset();const next=await prepare();await db.query('select bind_listing_product_checkout($1,$2)',[next.id,'cs_fixture']);
      await db.query('select expire_listing_product_checkout($1,$2)',[next.id,'cs_fixture']);await assert.rejects(deliver(next.id));
    });
    await t.test('publication requires paid access and cannot consume another listing license',async()=>{
      await reset();await assert.rejects(db.exec(`update marketplace_listings set status='published' where id='${listing}'`));
      const o=await prepare();await deliver(o.id);await db.exec(`reset role;update marketplace_listings set status='published' where id='${listing}'`);
      await assert.rejects(db.exec(`insert into marketplace_listings values('00000000-0000-4000-8000-000000000012','${owner}','published',now())`));
      await db.exec(`update marketplace_listings set status='sold' where id='${listing}'`);
      await assert.rejects(db.exec(`update marketplace_listings set status='published' where id='${listing}'`));
    });
    await t.test('pending checkout prevents status changes that would invalidate delivery',async()=>{
      await reset();await prepare();await db.exec('reset role');await assert.rejects(db.exec(`update marketplace_listings set status='withdrawn' where id='${listing}'`));
    });
    await t.test('refund before delivery cannot enable access; refund after delivery pauses the listing',async()=>{
      await reset();const o=await prepare();await db.exec("select revoke_listing_product_payment('pi_fixture','evt_refund','refunded')");
      await deliver(o.id);await db.exec('reset role');assert.equal((await db.query<{status:string}>('select status from listing_product_orders')).rows[0].status,'revoked');
      await reset();const p=await prepare();await deliver(p.id);await db.exec(`reset role;update marketplace_listings set status='published' where id='${listing}';set role service_role;select revoke_listing_product_payment('pi_fixture','evt_refund','refunded');reset role`);
      assert.equal((await db.query<{status:string}>('select status from marketplace_listings')).rows[0].status,'paused');assert.equal(await deliver(p.id,'evt_replay'),false);
    });
    await t.test('promotions require published fresh listings, have fixed expiry, and never expose payment identities',async()=>{
      await reset();await assert.rejects(prepare('enhanced_visibility'));
      await db.exec(`reset role;insert into billing_entitlements(user_id,product_code,active,source_event_id) values('${owner}','broker_plan',true,'evt_fixture');update marketplace_listings set status='published' where id='${listing}'`);
      const p=await prepare('highest_visibility');await db.query(`select deliver_listing_product($1,'cs_promo','pi_promo','evt_promo',$2,$3,'cus_fixture','highest_visibility','price_fixture')`,[p.id,owner,listing]);
      await db.exec('set role anon');const visible=(await db.query<Record<string,unknown>>('select * from active_listing_promotions()')).rows;
      assert.equal(visible.length,1);assert.deepEqual(Object.keys(visible[0]).sort(),['ends_at','listing_id','tier']);
      await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${other}',false)`);
      await db.query("select record_listing_promotion_engagement($1,'view')",[listing]);await db.query("select record_listing_promotion_engagement($1,'view')",[listing]);
      assert.equal((await db.query('select * from my_listing_promotion_metrics()')).rows.length,0);
      await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`);
      assert.equal((await db.query<{views:number}>('select * from my_listing_promotion_metrics()')).rows[0].views,1);
      await assert.rejects(prepare('enhanced_visibility'));
      await db.exec("reset role;update listing_product_orders set ends_at=now()-interval '1 second';set role anon");assert.equal((await db.query('select * from active_listing_promotions()')).rows.length,0);
    });
    await t.test('browser roles cannot mutate fulfillment; purchase history is owner scoped',async()=>{
      await reset();await prepare();for(const role of ['anon','authenticated']){
        await db.exec(`set role ${role}`);
        await assert.rejects(db.exec('select prepare_listing_product_order(null,null,null,null,null)'),{code:'42501'});
        await assert.rejects(db.exec("select revoke_listing_product_payment('pi_f','evt_f','refunded')"),{code:'42501'});
        await assert.rejects(db.exec('select * from listing_payment_revocations'),{code:'42501'});
      }
      await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);assert.equal((await db.query('select * from listing_product_orders')).rows.length,0);
      await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false)`);assert.equal((await db.query('select * from listing_product_orders')).rows.length,1);
    });
  }finally{await db.close();}
});
