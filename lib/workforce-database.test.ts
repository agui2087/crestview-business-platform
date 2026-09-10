import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Workforce migration permits documents and enforces employee ownership', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create table public.profiles(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${owner}'), ('${other}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/0008_workforce_and_organizations.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/0029_workforce_record_integrity.sql', import.meta.url), 'utf8'));
    const { rows: employees } = await db.query<{id:string}>(`insert into employees(user_id,full_name) values ($1,'Owner'),($2,'Other') returning id`, [owner, other]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.exec('set role authenticated');
    await db.query("insert into employee_records(user_id,employee_id,record_type,title) values ($1,$2,'document','Metadata')", [owner, employees[0].id]);
    await assert.rejects(db.query("insert into employee_records(user_id,employee_id,record_type,title) values ($1,$2,'document','Forbidden')", [owner, employees[1].id]), {code:'42501'});
    await db.query("insert into employee_records(user_id,employee_id,record_type,title,status) values ($1,$2,'pto','Leave','pending')", [owner, employees[0].id]);
    assert.equal((await db.query("update employee_records set status='approved' where record_type='pto' and status in ('active','pending') returning id")).rows.length, 1);
    assert.equal((await db.query("update employee_records set status='rejected' where record_type='pto' and status in ('active','pending') returning id")).rows.length, 0);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
    assert.equal((await db.query('select * from employee_records')).rows.length, 0);
    assert.equal((await db.query("update employee_records set status='rejected' returning id")).rows.length, 0);
  } finally { await db.close(); }
});
