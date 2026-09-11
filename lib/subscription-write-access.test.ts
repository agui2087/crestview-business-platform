import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('released schema enforces subscription writes and retains read/security access',async()=>{
 const db=new PGlite();const owner='00000000-0000-4000-8000-000000000001',hr='00000000-0000-4000-8000-000000000002';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.role() returns text language sql as $$select 'authenticated'::text$$;
   create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
   grant usage on schema auth to authenticated,anon,service_role;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);
   alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>/^\d{4}_/.test(n)&&!['0027','0028'].includes(n.slice(0,4))).sort()) {
   await db.exec((await readFile(new URL(name,dir),'utf8')).replace('create extension if not exists "pgcrypto";',''));
  }
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[owner,'owner@example.invalid',hr,'hr@example.invalid']);
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  await as(owner);
  await assert.rejects(db.query("select workforce_save_business($1,0,'Business','America/Los_Angeles')",[owner]),/read-only/);
  await db.exec('reset role');
  await db.query("insert into billing_entitlements(user_id,product_code,active,quantity,expires_at,source_event_id) values($1,'workforce',true,10,now()+interval '1 day','evt_fixture'),($1,'crestview_pro',true,1,now()+interval '1 day','evt_pro')",[owner]);
  await as(owner);await db.query("select workforce_save_business($1,0,'Business','America/Los_Angeles')",[owner]);
  const employee=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic') returning id",[owner])).rows[0].id;
  const membership=(await db.query<{id:string}>("select workforce_invite($1,'hr@example.invalid','hr',null) id",[owner])).rows[0].id;
  await as(hr);await db.query('select workforce_membership_decision($1,true)',[membership]);
  assert.equal((await db.query<{active:boolean}>('select * from workforce_billing_status($1)',[owner])).rows[0].active,true);
  await db.query("select workforce_update_employee($1,1,'{\"position\":\"Manager\"}')",[employee]);
  await as(owner);
  await db.query("insert into deal_document_findings(user_id,opportunity_key,source_document,metric_name,reported_value) values($1,'test','Source','Revenue','100')",[owner]);
  const schedule=()=>db.query("select workforce_save_schedule($1,null,0,'2026-09-01','2026-09-30','UTC',array[480,480,480,480,480,0,0],'Reviewed synthetic plan',false)",[employee]);
  await schedule();
  const adopt=()=>db.query("select workforce_adopt_leave_policy($1,'Synthetic leave','2026-09-01',null,60,600,false,array[]::date[],'Synthetic reviewed policy','manual_monthly')",[employee]);
  await adopt();
  await assert.rejects(db.query("update deal_document_findings set review_status='confirmed' where user_id=$1",[owner]),/independent/);
  await db.exec('reset role');await db.exec("update billing_entitlements set expires_at=now()-interval '1 minute'");
  await as(hr);
  await assert.rejects(db.query("select workforce_update_employee($1,2,'{\"position\":\"Changed\"}')",[employee]),/read-only/);
  assert.equal((await db.query('select id from employees')).rows.length,1);
  await as(owner);
  await assert.rejects(db.query("update deal_document_findings set review_status='reviewed' where user_id=$1",[owner]),/Pro subscription/);
  await assert.rejects(db.query("select workforce_save_schedule($1,null,0,'2026-10-01','2026-10-31','UTC',array[480,480,480,480,480,0,0],'Reviewed synthetic plan',false)",[employee]),/read-only/);
  await assert.rejects(db.query("select workforce_adopt_leave_policy($1,'Another leave','2026-09-01',null,60,600,false,array[]::date[],'Synthetic reviewed policy','manual_monthly')",[employee]),/read-only/);
  assert.equal((await db.query('select id from workforce_schedules')).rows.length,1);
  assert.equal((await db.query('select id from workforce_leave_policies')).rows.length,1);
  await db.query('select workforce_membership_decision($1,false)',[membership]);
  await as(hr);await assert.rejects(db.query('select * from workforce_billing_status($1)',[owner]),/authorized/);
  await db.exec('reset role');
  assert.equal((await db.query<{n:number}>("select count(*)::int n from pg_trigger where tgname='subscription_write_access'")).rows[0].n,21);
  assert.equal((await db.query<{n:number}>('select workforce_run_accruals() n')).rows[0].n,0);
  await db.exec("update billing_entitlements set expires_at=now()+interval '1 day'");
  await as(owner);
  await db.query("select workforce_update_employee($1,2,'{\"position\":\"Renewed\"}')",[employee]);
  await db.query("update deal_document_findings set review_status='reviewed' where user_id=$1",[owner]);
  assert.equal((await db.query<{position:string}>('select position from employees where id=$1',[employee])).rows[0].position,'Renewed');
 } finally {await db.close();}
});
