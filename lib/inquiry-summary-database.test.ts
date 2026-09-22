import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('buyer summary rejects anonymous and unrelated callers and respects each NDA',async()=>{
 const db=new PGlite();
 const buyer='00000000-0000-4000-8000-000000000001',broker='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',signed='00000000-0000-4000-8000-000000000004',unsigned='00000000-0000-4000-8000-000000000005';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
  create table profiles(user_id uuid,display_name text,verification_status text);
  create table buyer_preferences(user_id uuid,share_experience text,share_summary text,buyer_summary text,experience_level text,acquisition_timeline text,funding_status text,proof_of_funds_status text);
  create table buyer_financial_profiles(user_id uuid,share_financial text,available_cash numeric,credit_readiness text);
  create table deal_inquiries(id uuid,buyer_id uuid,broker_id uuid);
  create table deal_ndas(inquiry_id uuid,status text);`);
  await db.query("insert into profiles values($1,'Synthetic buyer','unverified')",[buyer]);
  await db.query("insert into buyer_preferences values($1,'nda','nda','Private introduction','first_time','exploring','exploring','available')",[buyer]);
  await db.query("insert into buyer_financial_profiles values($1,'nda',100000,'not_provided')",[buyer]);
  await db.query('insert into deal_inquiries values($1,$2,$3),($4,$2,$3)',[signed,buyer,broker,unsigned]);
  await db.query("insert into deal_ndas values($1,'signed')",[signed]);
  await db.exec(await readFile(new URL('../supabase/migrations/0063_buyer_summary_privacy.sql',import.meta.url),'utf8'));
  await db.exec('set role anon');await assert.rejects(db.query('select get_broker_buyer_summary($1)',[signed]));
  await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select get_broker_buyer_summary($1)',[signed]));
  for(const actor of [buyer,other]){await db.query("select set_config('test.uid',$1,false)",[actor]);await assert.rejects(db.query('select get_broker_buyer_summary($1)',[signed]));}
  await db.query("select set_config('test.uid',$1,false)",[broker]);
  const get=async(id:string)=>(await db.query<{summary:{available_cash:number|null;buyer_summary:string|null}}>('select get_broker_buyer_summary($1) as summary',[id])).rows[0].summary;
  assert.equal((await get(signed)).available_cash,100000);assert.equal((await get(unsigned)).available_cash,null);assert.equal((await get(unsigned)).buyer_summary,null);
  await db.exec("reset role;update buyer_financial_profiles set share_financial='private';set role authenticated");assert.equal((await get(signed)).available_cash,null);
 }finally{await db.close();}
});
