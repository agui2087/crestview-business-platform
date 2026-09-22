import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("seller preparation is owner-only even for a published listing",async()=>{
 const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',listing='00000000-0000-4000-8000-000000000003';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create table marketplace_listings(id uuid primary key,broker_id uuid);grant select on marketplace_listings to authenticated;
   insert into marketplace_listings values('${listing}','${owner}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/0068_seller_preparation.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.query("insert into seller_preparation(listing_id,completed_steps) values($1,array['periods'])",[listing]);
  assert.deepEqual((await db.query('select completed_steps from seller_preparation')).rows,[{completed_steps:['periods']}]);
  await assert.rejects(db.query("update seller_preparation set completed_steps=array['verified_business']"));
  await db.query("select set_config('test.uid',$1,false)",[other]);
  assert.equal((await db.query('select * from seller_preparation')).rows.length,0);
  assert.equal((await db.query("update seller_preparation set completed_steps='{}' returning listing_id")).rows.length,0);
  await assert.rejects(db.query("insert into seller_preparation(listing_id) values($1)",[listing]));
  await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec("update seller_preparation set completed_steps='{}'");
  assert.deepEqual((await db.query('select completed_steps from seller_preparation')).rows,[{completed_steps:[]}]);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from seller_preparation'));
 }finally{await db.close();}
});
