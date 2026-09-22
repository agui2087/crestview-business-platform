import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('account notification preferences suppress only selected optional notices and remain private',async()=>{
 const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;create table marketplace_notifications(user_id uuid,kind text);grant insert,select on marketplace_notifications to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/0070_notification_preferences.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');await db.query("select set_config('test.uid',$1,false)",[owner]);
  await db.query('insert into buyer_notification_preferences(user_id,messages,documents,deal_status) values($1,false,false,false)',[owner]);
  for(const kind of ['message','document','document_request','status','nda','nda_reminder','financial_access','security'])await db.query('insert into marketplace_notifications values($1,$2)',[owner,kind]);
  assert.deepEqual((await db.query<{kind:string}>('select kind from marketplace_notifications')).rows.map(row=>row.kind),['nda','nda_reminder','financial_access','security']);
  await db.query("select set_config('test.uid',$1,false)",[other]);
  assert.equal((await db.query('select * from buyer_notification_preferences')).rows.length,0);
  assert.equal((await db.query('update buyer_notification_preferences set messages=true returning user_id')).rows.length,0);
  await assert.rejects(db.query('insert into buyer_notification_preferences(user_id) values($1)',[owner]));
  await db.query("insert into marketplace_notifications values($1,'message')",[other]);
  assert.equal((await db.query("select * from marketplace_notifications where user_id=$1",[other])).rows.length,1);
  await db.query("select set_config('test.uid',$1,false)",[owner]);await db.exec('update buyer_notification_preferences set messages=true');
  await db.query("insert into marketplace_notifications values($1,'message')",[owner]);
  assert.equal((await db.query("select * from marketplace_notifications where user_id=$1 and kind='message'",[owner])).rows.length,1);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from buyer_notification_preferences'));
 }finally{await db.close();}
});
