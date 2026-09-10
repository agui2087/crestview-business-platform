import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {buildWorkforceStagingBootstrap} from './workforce-staging-bootstrap.ts';

test('staging bootstrap rejects production and incomplete manifests',()=>{
  assert.throws(()=>buildWorkforceStagingBootstrap('gsabakontancxutgsbem',[]),/isolated staging/);
  assert.throws(()=>buildWorkforceStagingBootstrap('bxtrkycetuoqooammgpp',[]),/manifest/);
});

for (const existingBilling of [false, true]) test(existingBilling
  ? 'incremental Workforce bootstrap preserves modeled billing data and routines'
  : 'complete released fresh-install schema initializes Workforce and security dependencies',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
      create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
      grant usage on schema auth to authenticated,anon,service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    const billingTables=['billing_customers','billing_subscriptions','billing_entitlements','stripe_webhook_events','stripe_checkout_fulfillments'];
    const billingSnapshot=async()=>Promise.all(billingTables.map(async table=>(await db.query(`select to_jsonb(t) as record from public.${table} t`)).rows));
    const routineSnapshot=async()=>(await db.query("select pg_get_functiondef(oid) as definition,proacl::text as acl from pg_proc where pronamespace='public'::regnamespace and proname='apply_stripe_billing_event' order by oid")).rows;
    let beforeRows:unknown;
    let beforeRoutine:unknown;
    if(existingBilling){
      await db.exec(await readFile(new URL('0010_stripe_billing.sql',directory),'utf8'));
      // Model the already-existing receipt table without applying unreleased billing migrations.
      // Hosted staging shape/routines must still be audited before using this sequence there.
      await db.exec(`create table public.stripe_checkout_fulfillments(
        checkout_session_id text primary key,first_event_id text not null unique,
        user_id uuid not null references auth.users(id) on delete cascade,
        product_code text not null,fulfilled_at timestamptz not null default now());
        alter table public.stripe_checkout_fulfillments enable row level security;
        revoke all on public.stripe_checkout_fulfillments from public,anon,authenticated;
        insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','synthetic@example.invalid');
        insert into public.billing_customers(user_id,stripe_customer_id,email) values('11111111-1111-4111-8111-111111111111','cus_synthetic','synthetic@example.invalid');
        insert into public.billing_subscriptions(stripe_subscription_id,user_id,stripe_customer_id,product_code,stripe_price_id,status)
          values('sub_synthetic','11111111-1111-4111-8111-111111111111','cus_synthetic','workforce','price_synthetic','active');
        insert into public.billing_entitlements(user_id,product_code,active,quantity,source_event_id)
          values('11111111-1111-4111-8111-111111111111','workforce',true,3,'evt_synthetic');
        insert into public.stripe_webhook_events(stripe_event_id,event_type) values('evt_synthetic','test.fixture');
        insert into public.stripe_checkout_fulfillments(checkout_session_id,first_event_id,user_id,product_code)
          values('cs_synthetic','evt_synthetic','11111111-1111-4111-8111-111111111111','workforce');`);
      beforeRows=await billingSnapshot();beforeRoutine=await routineSnapshot();
    }
    const names=(await readdir(directory)).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&Number(n.slice(0,4))<=41&&![27,28].includes(Number(n.slice(0,4)))).sort();
    if(existingBilling){
      const migrations=await Promise.all(names.map(async name=>({name,sql:(await readFile(new URL(name,directory),'utf8')).replace('create extension if not exists "pgcrypto";','')})));
      const damaged=migrations.map(m=>m.name.startsWith('0041_')?{...m,sql:m.sql+"\nupdate public.billing_entitlements set quantity=99;"}:m);
      await assert.rejects(db.exec(buildWorkforceStagingBootstrap('bxtrkycetuoqooammgpp',damaged)),/Billing preservation failed/);
      await db.exec('rollback;');
      assert.deepEqual(await billingSnapshot(),beforeRows);
      assert.equal((await db.query<{name:string|null}>("select to_regclass('public.employees') as name")).rows[0].name,null);
      const sql=buildWorkforceStagingBootstrap('bxtrkycetuoqooammgpp',migrations);
      await db.exec(sql);
      await assert.rejects(db.exec(sql),/billing-only staging state/);
      await db.exec('rollback;');
    } else for(const name of names){
      if(existingBilling&&name==='0010_stripe_billing.sql')continue;
      let sql=await readFile(new URL(name,directory),'utf8');
      // PGlite already provides gen_random_uuid; hosted PostgreSQL keeps pgcrypto.
      sql=sql.replace('create extension if not exists "pgcrypto";','');
      try{await db.exec(sql);}catch(error){throw new Error(`Migration ${name} failed`,{cause:error});}
    }
    for(const table of ['profiles','employees','workforce_members','workforce_leave_ledger','workforce_training_evidence','workforce_payroll_imports','document_security_events'])assert.ok((await db.query<{name:string|null}>('select to_regclass($1) as name',[`public.${table}`])).rows[0]?.name);
    const r=await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.workforce_payroll_periods(uuid)','EXECUTE') allowed");assert.equal(r.rows[0].allowed,false);
    if(existingBilling){
      assert.deepEqual(await billingSnapshot(),beforeRows);
      assert.deepEqual(await routineSnapshot(),beforeRoutine);
      assert.equal((await db.query<{count:number}>('select count(*)::int count from auth.users')).rows[0].count,1);
      // Existing auth accounts are deliberately not silently assigned new profile/HR records.
      assert.equal((await db.query<{count:number}>('select count(*)::int count from public.profiles')).rows[0].count,0);
    }
  }finally{await db.close();}
});
