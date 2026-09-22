import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('replacement preserves originals, access and requests; rejects stale, unsafe and unauthorized swaps',async()=>{
 const db=new PGlite();const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const broker=id(1),buyer=id(2),outsider=id(3),deal=id(4),old=id(5),fresh=id(6),other=id(7);
 try{
  await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth,storage to authenticated;
   create table deal_inquiries(id uuid primary key,broker_id uuid,buyer_id uuid);
   create table deal_room_documents(id uuid primary key,inquiry_id uuid,uploaded_by uuid,title text,category text,
    storage_path text,external_url text,mime_type text,original_filename text,file_size_bytes bigint,
    version integer default 1,is_active boolean default true,security_status text,access_level text,permission_note text);
   create table deal_document_requests(id uuid primary key,inquiry_id uuid,document_id uuid);
   create table marketplace_audit_events(actor_id uuid,inquiry_id uuid,event_type text,details jsonb);
   create table storage.objects(id uuid,bucket_id text,name text);
   grant all on all tables in schema public,storage to authenticated;
   alter table deal_room_documents enable row level security;
   create policy owner_write on deal_room_documents for all to authenticated using(uploaded_by=auth.uid()) with check(uploaded_by=auth.uid());
   create policy buyer_read on deal_room_documents for select to authenticated using(access_level<>'broker_only' and exists(select 1 from deal_inquiries where id=inquiry_id and buyer_id=auth.uid()));
   alter table storage.objects enable row level security;
   create policy storage_read on storage.objects for select to authenticated using(exists(select 1 from deal_room_documents where storage_path=name));
   create policy storage_delete on storage.objects for delete to authenticated using(true);
   alter table marketplace_audit_events enable row level security;
   create policy audit_read on marketplace_audit_events for select to authenticated using(true);`);
  await db.exec(await readFile(new URL('../supabase/migrations/0074_deal_document_replacement.sql',import.meta.url),'utf8'));
  await db.query('insert into deal_inquiries values($1,$2,$3)',[deal,broker,buyer]);
  for(const [doc,path,access] of [[old,'original.csv','approved'],[fresh,'new.csv','broker_only'],[other,'other.csv','broker_only']]){
   await db.query("insert into deal_room_documents(id,inquiry_id,uploaded_by,title,category,storage_path,security_status,access_level,permission_note) values($1,$2,$3,'Original title','Financial',$4,'basic_validated',$5,'Approval required')",[doc,deal,broker,path,access]);
   await db.query("insert into storage.objects values($1,'deal-files',$2)",[doc,path]);
  }
  await db.query('insert into deal_document_requests values($1,$2,$3)',[id(8),deal,old]);
  const actor=async(who:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await db.exec('set role authenticated');};
  const replace=(candidate=fresh,version=1,access='approved')=>db.query("select replace_deal_document($1,$2,$3,$4,'Updated figures')",[old,candidate,version,access]);
  await actor(buyer);await assert.rejects(replace(),/owning broker/);
  await actor(outsider);await assert.rejects(replace(),/owning broker/);
  await actor(broker);await assert.rejects(replace(fresh,2),/changed/);await assert.rejects(replace(fresh,1,'nda_signed'),/changed/);
  await assert.rejects(db.query("update deal_room_documents set storage_path='unscanned.csv' where id=$1",[old]),/verified replacement/);
  await db.exec('reset role');await db.query("update deal_room_documents set security_status='quarantined' where id=$1",[fresh]);
  await actor(broker);await assert.rejects(replace(),/screened/);
  await db.exec('reset role');await db.query("update deal_room_documents set security_status='basic_validated' where id=$1",[fresh]);
  await actor(broker);await replace();await assert.rejects(replace(other),/changed/);
  const rows=(await db.query<{id:string;is_active:boolean;access_level:string;version:number;storage_path:string;replacement_note:string}>('select * from deal_room_documents order by id')).rows;
  assert.equal(rows.find(d=>d.id===old)?.is_active,false);assert.equal(rows.find(d=>d.id===old)?.storage_path,'original.csv');
  assert.equal(rows.find(d=>d.id===fresh)?.access_level,'approved');assert.equal(rows.find(d=>d.id===fresh)?.version,2);assert.equal(rows.find(d=>d.id===fresh)?.replacement_note,'Updated figures');
  assert.equal((await db.query<{document_id:string}>('select document_id from deal_document_requests')).rows[0].document_id,fresh);
  await db.query('delete from deal_room_documents where id=$1',[old]);assert.equal((await db.query('select id from deal_room_documents where id=$1',[old])).rows.length,1);
  await db.query("delete from storage.objects where name='original.csv'");assert.equal((await db.query("select name from storage.objects where name='original.csv'")).rows.length,1);
  await actor(buyer);assert.equal((await db.query('select id from deal_room_documents where id=$1',[old])).rows.length,0);
  assert.equal((await db.query("select name from storage.objects where name='original.csv'")).rows.length,0);
  assert.equal((await db.query('select id from deal_room_documents where id=$1',[fresh])).rows.length,1);
  await actor(outsider);assert.equal((await db.query("select * from marketplace_audit_events where event_type='document_replaced'")).rows.length,0);
 }finally{await db.close();}
});
