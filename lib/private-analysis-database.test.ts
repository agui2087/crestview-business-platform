import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('private queue enforces owner, Pro, leases, offline persistence and source replacement',async()=>{
 const db=new PGlite();
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',doc='00000000-0000-4000-8000-000000000003';
 const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 try{
  await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;
   create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;
   create table ai_analysis_usage(id uuid primary key default gen_random_uuid(),user_id uuid,opportunity_id uuid not null,status text default 'reserved',created_at timestamptz default now(),completed_at timestamptz);
   create table vault_documents(id uuid primary key,owner_id uuid,content_type text,size_bytes bigint,security_status text,scan_sha256 text,storage_key text);
   create table billing_entitlements(user_id uuid,product_code text,active boolean,expires_at timestamptz);`);
  await db.exec(await readFile(new URL('../supabase/migrations/0049_private_document_analysis.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[owner,other]);
  await db.query("insert into vault_documents values($1,$2,'application/pdf',100,'basic_validated',$3,'synthetic.pdf')",[doc,owner,'a'.repeat(64)]);
  await as(owner);await assert.rejects(db.query("select queue_private_document_analysis($1,'en')",[doc]));
  await db.exec('reset role');await db.query("insert into billing_entitlements values($1,'crestview_pro',true,null)",[owner]);
  await as(other);await assert.rejects(db.query("select queue_private_document_analysis($1,'en')",[doc]));
  await as(owner);const job=(await db.query<{id:string}>("select queue_private_document_analysis($1,'en') id",[doc])).rows[0].id;
  assert.equal((await db.query<{id:string}>("select queue_private_document_analysis($1,'en') id",[doc])).rows[0].id,job);
  await assert.rejects(db.query('select * from private_document_analysis_jobs'),{code:'42501'});
  await assert.rejects(db.query('select * from claim_private_document_analysis()'),{code:'42501'});
  await db.exec("reset role;update private_document_analysis_jobs set created_at=now()-interval '2 days'");
  await as(owner);assert.equal((await db.query<{status:string}>('select * from read_private_document_analysis($1)',[doc])).rows[0].status,'queued');
  await db.exec('reset role;set role service_role');
  const claimed=(await db.query<{id:string;lease_token:string}>('select * from claim_private_document_analysis()')).rows[0];assert.equal(claimed.id,job);
  assert.equal((await db.query<{ok:boolean}>('select finish_private_document_analysis($1,$2,null,$3) ok',[job,other,'invalid_result'])).rows[0].ok,false);
  await db.exec('reset role');await db.query('update vault_documents set scan_sha256=$1',['b'.repeat(64)]);
  await db.exec('set role service_role');await db.query("select finish_private_document_analysis($1,$2,'{}',null)",[job,claimed.lease_token]);
  await db.exec('reset role');assert.equal((await db.query<{status:string}>('select status from private_document_analysis_jobs')).rows[0].status,'failed');
  await as(owner);assert.equal((await db.query('select * from read_private_document_analysis($1)',[doc])).rows.length,0);
  await db.exec('reset role;delete from vault_documents');assert.equal((await db.query('select * from private_document_analysis_jobs')).rows.length,0);assert.equal((await db.query('select * from ai_analysis_usage')).rows.length,1);
 }finally{await db.close();}
});
