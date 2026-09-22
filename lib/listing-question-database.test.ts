import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("public questions are atomic, retry-safe, role-checked and never issue NDAs", async () => {
 const db = new PGlite();
 const buyer='00000000-0000-4000-8000-000000000001', broker='00000000-0000-4000-8000-000000000002', listing='00000000-0000-4000-8000-000000000003';
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create table profiles(user_id uuid,account_roles text[]);
   create table marketplace_listings(id uuid,broker_id uuid,title text,status text);
   create table deal_inquiries(id uuid default gen_random_uuid() primary key,listing_id uuid,buyer_id uuid,broker_id uuid,subject text,initial_message text,requested_items text[],status text,unique(listing_id,buyer_id));
   create table deal_messages(inquiry_id uuid,sender_id uuid,recipient_id uuid,body text,created_at timestamptz default now());
   create table marketplace_notifications(user_id uuid,inquiry_id uuid,kind text,title text,body text,href text);
   grant select,insert,update on all tables in schema public to authenticated;
   insert into profiles values('${buyer}',array['buyer']),('${broker}',array['broker']);
   insert into marketplace_listings values('${listing}','${broker}','Synthetic business','published');`);
  await db.exec(await readFile(new URL('../supabase/migrations/0066_public_listing_questions.sql',import.meta.url),'utf8'));
  const ask=(question='What operating experience would help?')=>db.query<{id:string}>('select ask_listing_question($1,$2,$3) id',[listing,question,'en']);
  await db.exec('set role anon'); await assert.rejects(ask());
  await db.exec('reset role;set role authenticated'); await assert.rejects(ask());
  await db.query("select set_config('test.uid',$1,false)",[broker]); await assert.rejects(ask());
  await db.query("select set_config('test.uid',$1,false)",[buyer]);
  const id=(await ask()).rows[0].id;
  assert.equal((await ask()).rows[0].id,id);
  assert.equal((await db.query('select * from deal_messages')).rows.length,1);
  assert.equal((await db.query('select * from marketplace_notifications')).rows.length,1);
  assert.deepEqual((await db.query('select status,requested_items from deal_inquiries')).rows,[{status:'submitted',requested_items:['Public listing question']}]);
  await ask('How many hours does the current owner work?');
  assert.equal((await db.query('select * from deal_messages')).rows.length,2);
  await db.exec("update deal_inquiries set status='declined'"); await assert.rejects(ask('Could I ask another public question?'));
  await db.exec("update deal_inquiries set status='submitted';reset role;alter table marketplace_notifications add constraint force_failure check(false) not valid;set role authenticated");
  await assert.rejects(ask('This submission must roll back on notification failure.'));
  assert.equal((await db.query('select * from deal_messages')).rows.length,2);
 } finally { await db.close(); }
});
