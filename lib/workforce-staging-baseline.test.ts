import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('complete released fresh-install schema initializes Workforce and security dependencies',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
      create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
      grant usage on schema auth to authenticated,anon,service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    const names=(await readdir(directory)).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&Number(n.slice(0,4))<=41&&![27,28].includes(Number(n.slice(0,4)))).sort();
    for(const name of names){
      let sql=await readFile(new URL(name,directory),'utf8');
      // PGlite already provides gen_random_uuid; hosted PostgreSQL keeps pgcrypto.
      sql=sql.replace('create extension if not exists "pgcrypto";','');
      try{await db.exec(sql);}catch(error){throw new Error(`Migration ${name} failed`,{cause:error});}
    }
    for(const table of ['profiles','employees','workforce_members','workforce_leave_ledger','workforce_training_evidence','workforce_payroll_imports','document_security_events'])assert.ok((await db.query<{name:string|null}>('select to_regclass($1) as name',[`public.${table}`])).rows[0]?.name);
    const r=await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.workforce_payroll_periods(uuid)','EXECUTE') allowed");assert.equal(r.rows[0].allowed,false);
  }finally{await db.close();}
});
