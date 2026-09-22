import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('broker profiles isolate drafts, enforce ownership and hide former brokers',async()=>{
 const db=new PGlite();const broker='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create table profiles(user_id uuid primary key,account_roles text[]);alter table profiles enable row level security;`);
 await db.query('insert into auth.users values($1),($2)',[broker,other]);await db.query("insert into profiles values($1,array['broker']),($2,array['buyer'])",[broker,other]);
 await db.exec(await readFile(new URL('../supabase/migrations/0061_broker_profiles.sql',import.meta.url),'utf8'));
 await db.query("select set_config('test.uid',$1,false)",[broker]);await db.exec('set role authenticated');
 await db.query("insert into broker_profiles(user_id,display_name,biography)values($1,'Test Broker',$2)",[broker,'I welcome buyers preparing for their first business acquisition.']);
 assert.equal((await db.query('select * from broker_profiles')).rows.length,1);
 await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[other]);await db.exec('set role authenticated');
 assert.equal((await db.query('select * from broker_profiles')).rows.length,0);
 await assert.rejects(db.query("insert into broker_profiles(user_id,display_name)values($1,'Not Broker')",[other]));
 assert.equal((await db.query("update broker_profiles set published=true returning user_id")).rows.length,0);
 await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[broker]);await db.exec('set role authenticated');await db.exec('update broker_profiles set published=true');
 await db.exec('reset role');await db.exec("select set_config('test.uid','',false);set role anon");assert.equal((await db.query('select * from broker_profiles')).rows.length,1);
 await assert.rejects(db.exec('update broker_profiles set published=false'));
 await db.exec('reset role');await db.query("update profiles set account_roles=array['buyer'] where user_id=$1",[broker]);await db.exec('set role anon');assert.equal((await db.query('select * from broker_profiles')).rows.length,0);
 await db.exec('reset role');await db.query("update profiles set account_roles=array['broker'] where user_id=$1",[broker]);await db.query("select set_config('test.uid',$1,false)",[broker]);await db.exec('set role authenticated');await db.exec('update broker_profiles set published=false');
 await db.exec("reset role;select set_config('test.uid','',false);set role anon");assert.equal((await db.query('select * from broker_profiles')).rows.length,0);
 }finally{await db.close();}
});
