import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('broker stage updates are atomic, scoped, explained and cannot skip signing or confirmation',async()=>{
 const db=new PGlite(),broker='00000000-0000-4000-8000-000000000001',buyer='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;
  create table deal_inquiries(id uuid primary key,broker_id uuid,buyer_id uuid,status text,updated_at timestamptz);
  create table deal_status_events(inquiry_id uuid,actor_id uuid,from_status text,to_status text,note text);
  create table deal_messages(inquiry_id uuid,sender_id uuid,recipient_id uuid,body text);
  create table marketplace_notifications(user_id uuid,inquiry_id uuid,kind text,title text,body text,href text);
  grant select,insert,update on all tables in schema public to authenticated;
  insert into deal_inquiries values('${id}','${broker}','${buyer}','submitted','2026-01-01');`);
  await db.exec(await readFile(new URL('../supabase/migrations/0071_atomic_deal_stage.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');await db.query("select set_config('test.uid',$1,false)",[buyer]);
  const advance=async(status:string,reason='',confirm=false)=>db.query('select advance_my_broker_inquiry($1,(select updated_at from deal_inquiries where id=$1),$2,$3,$4)',[id,status,reason,confirm]);
  await assert.rejects(advance('declined','Synthetic reason for the buyer'));
  await db.query("select set_config('test.uid',$1,false)",[broker]);
  await assert.rejects(advance('nda_signed'));await assert.rejects(advance('declined'));
  await assert.rejects(db.query("select advance_my_broker_inquiry($1,'2000-01-01','screening')",[id]));
  await advance('declined','The seller needs a different transition timeline. You can revisit this later.');
  assert.equal((await db.query<{status:string}>('select status from deal_inquiries')).rows[0].status,'declined');
  assert.equal((await db.query('select * from deal_messages')).rows.length,1);
  await advance('screening','We can discuss the revised transition timeline together.');
  assert.equal((await db.query('select * from deal_status_events')).rows.length,2);
  await db.exec("reset role;create function fail_notice() returns trigger language plpgsql as $$begin raise exception 'Synthetic failure';end;$$;create trigger fail_notice before insert on marketplace_notifications for each row execute function fail_notice();set role authenticated;");
  await assert.rejects(advance('declined','This transaction must roll back completely.'));
  assert.equal((await db.query<{status:string}>('select status from deal_inquiries')).rows[0].status,'screening');
  assert.equal((await db.query('select * from deal_status_events')).rows.length,2);
  assert.equal((await db.query('select * from deal_messages')).rows.length,2);
  await db.exec("reset role;drop trigger fail_notice on marketplace_notifications;update deal_inquiries set status='offer';set role authenticated;");
  await assert.rejects(advance('closed'));await advance('closed','External closing confirmed by the parties.',true);
  await assert.rejects(advance('screening'));
  await db.exec('reset role;set role anon');await assert.rejects(advance('screening'));
 } finally {await db.close();}
});
