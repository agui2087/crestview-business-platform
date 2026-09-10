import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('training evidence shares only an explicitly owned clean revision and follows current personnel access',async()=>{
  const db=new PGlite(),ids=Array.from({length:5},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
  const [owner,hr,manager,employee,outsider]=ids;
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])");
    for(const id of ids)await db.query('insert into auth.users values($1,null)',[id]);
    for(const name of ['0008_workforce_and_organizations','0018_private_document_vault','0021_vault_uuid_ownership','0029_workforce_record_integrity','0030_workforce_operations','0031_workforce_checklist_management'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    // Minimal security metadata from 0023/0025; no storage or scanner is mocked as a live service.
    await db.exec("alter table vault_documents add column security_status text, add column scan_sha256 text");
    await db.exec(await readFile(new URL('../supabase/migrations/0038_workforce_training_evidence.sql',import.meta.url),'utf8'));
    await as(owner);
    const e=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic worker') returning id",[owner])).rows[0].id;
    await db.exec('reset role');
    await db.query("insert into workforce_members(owner_id,user_id,role,employee_id,accepted_at) values($1,$2,'hr',null,now()),($1,$3,'manager',null,now()),($1,$4,'employee',$5,now())",[owner,hr,manager,employee,e]);
    await as(owner);await db.query("select workforce_update_employee($1,1,jsonb_build_object('manager_user_id',$2::text))",[e,manager]);
    const task=(await db.query<{id:string}>("select workforce_assign_task($1,'training','Synthetic certificate',$2,'2026-12-31') id",[e,employee])).rows[0].id;
    await db.exec('reset role');
    const doc=(await db.query<{id:string}>("insert into vault_documents(id,owner_key,owner_id,storage_key,original_name,content_type,size_bytes,security_status,scan_sha256) values(gen_random_uuid(),'uuid-owned',$1,'private/revision1','certificate.pdf','application/pdf',10,'malware_scanned',repeat('a',64)) returning id",[employee])).rows[0].id;
    const share=()=>db.query<{id:string}>('select workforce_share_training_evidence($1,1,$2) id',[task,doc]);
    await as(owner);await assert.rejects(share()); // owner cannot share another person's private vault
    await as(outsider);await assert.rejects(share());
    await as(employee);const id=(await share()).rows[0].id;assert.equal((await share()).rows[0].id,id);
    const available=async()=>Boolean((await db.query<{ok:boolean}>('select workforce_training_evidence_available($1) ok',[id])).rows[0].ok);
    for(const actor of [owner,hr,manager,employee]){await as(actor);assert.equal(await available(),true);assert.equal((await db.query('select id from workforce_training_evidence')).rows.length,1);}
    await assert.rejects(db.query('select storage_key from workforce_training_evidence'),{code:'42501'});
    await assert.rejects(db.query('select * from vault_documents'),{code:'42501'});
    await as(outsider);assert.equal(await available(),false);assert.equal((await db.query('select id from workforce_training_evidence')).rows.length,0);
    await db.exec('reset role');await db.query("update vault_documents set security_status='blocked' where id=$1",[doc]);
    await as(employee);assert.equal(await available(),false);
    await db.exec('reset role');await db.query("update vault_documents set security_status='malware_scanned',storage_key='private/revision2' where id=$1",[doc]);
    await as(employee);assert.equal(await available(),false); // no silent replacement
    await db.exec('reset role');await db.query("update vault_documents set storage_key='private/revision1' where id=$1",[doc]);
    await db.query('update workforce_members set revoked_at=now() where user_id=$1',[employee]);
    await as(employee);assert.equal(await available(),false);await assert.rejects(share());
    await as(hr);assert.equal(await available(),true);
    assert.equal((await db.query<{ok:boolean}>('select workforce_record_evidence_download($1) ok',[id])).rows[0].ok,true);
    await db.query("select workforce_revoke_training_evidence($1,'Review withdrawn')",[id]);assert.equal(await available(),false);
    assert.equal((await db.query<{ok:boolean}>('select workforce_record_evidence_download($1) ok',[id])).rows[0].ok,false);
    assert.equal((await db.query('select id from workforce_training_evidence')).rows.length,1); // audit metadata retained
    await assert.rejects(db.query('delete from workforce_training_evidence'),{code:'42501'});
    await db.exec('reset role; set role anon');await assert.rejects(available(),{code:'42501'});
  }finally{await db.close();}
});
