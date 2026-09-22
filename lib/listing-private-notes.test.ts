import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("private listing notes migrate safely and cannot be read through public listing rows",async()=>{
 const db=new PGlite();
 const owner='00000000-0000-4000-8000-000000000001',buyer='00000000-0000-4000-8000-000000000002',listing='00000000-0000-4000-8000-000000000003',second='00000000-0000-4000-8000-000000000004';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   insert into auth.users values('${owner}'),('${buyer}');
   create table marketplace_listings(id uuid primary key,broker_id uuid,status text,confidential_notes text,updated_at timestamptz default '2026-01-01');
   alter table marketplace_listings enable row level security;
   create policy published on marketplace_listings for select using(status='published' or broker_id=auth.uid());
   create policy own on marketplace_listings for all using(broker_id=auth.uid()) with check(broker_id=auth.uid());
   grant select,insert,update on marketplace_listings to authenticated;
   insert into marketplace_listings(id,broker_id,status,confidential_notes) values('${listing}','${owner}','published','PRIVATE SYNTHETIC NOTE');`);
  await db.exec(await readFile(new URL('../supabase/migrations/0067_private_listing_notes.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');await db.query("select set_config('test.uid',$1,false)",[buyer]);
  assert.equal((await db.query<{confidential_notes:string|null}>('select confidential_notes from marketplace_listings')).rows[0].confidential_notes,null);
  assert.equal((await db.query('select * from listing_private_notes')).rows.length,0);
  await assert.rejects(db.query("insert into listing_private_notes values($1,$2,'tampered',now())",[second,buyer]));
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  assert.equal((await db.query<{notes:string}>('select notes from listing_private_notes')).rows[0].notes,'PRIVATE SYNTHETIC NOTE');
  await db.query("insert into marketplace_listings(id,broker_id,status,confidential_notes) values($1,$2,'published','NEW PRIVATE NOTE')",[second,owner]);
  assert.equal((await db.query('select * from listing_private_notes')).rows.length,2);
  await db.query("update marketplace_listings set confidential_notes='UPDATED PRIVATE NOTE' where id=$1",[second]);
  assert.equal((await db.query<{notes:string}>('select notes from listing_private_notes where listing_id=$1',[second])).rows[0].notes,'UPDATED PRIVATE NOTE');
  assert.equal((await db.query('select * from marketplace_listings where confidential_notes is not null')).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from listing_private_notes'));
 }finally{await db.close();}
});
