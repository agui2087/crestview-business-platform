import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('Workforce database capacity protects inserts, imports, restores and business identity without deleting records', async () => {
  const db = new PGlite();
  const owner='00000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create table billing_entitlements(user_id uuid,product_code text,active boolean,quantity integer,expires_at timestamptz);
      create table employees(id uuid primary key default gen_random_uuid(),user_id uuid not null,full_name text,employment_status text default 'active',archived_at timestamptz);
      insert into auth.users values('${owner}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/0046_workforce_capacity.sql',import.meta.url),'utf8'));
    const add = () => db.query<{id:string}>('insert into employees(user_id,full_name) values($1,\'Person\') returning id',[owner]);
    await assert.rejects(add(),/subscription/);
    await db.query("insert into billing_entitlements values($1,'workforce',true,2,null)",[owner]);
    const first=String((await add()).rows[0].id); await add();
    await assert.rejects(add(),/capacity/);
    await db.query('update employees set archived_at=now() where id=$1',[first]);
    // A multi-row import is atomic even when only one seat remains.
    await assert.rejects(db.query("insert into employees(user_id) values($1),($1)",[owner]),/capacity/);
    assert.equal((await db.query('select * from employees')).rows.length,2);
    await add();
    await assert.rejects(db.query('update employees set archived_at=null where id=$1',[first]),/capacity/);
    await db.exec('update billing_entitlements set active=false');
    await assert.rejects(add(),/subscription/);
    await db.query("update employees set full_name='Preserved' where id=$1",[first]);
    assert.equal((await db.query('select * from employees')).rows.length,3);
    await db.exec("update billing_entitlements set active=true,expires_at=now()-interval '1 minute'");
    await assert.rejects(add(),/subscription/);
    await assert.rejects(db.query("update employees set user_id='00000000-0000-4000-8000-000000000002' where id=$1",[first]),/business/);
  } finally { await db.close(); }
});
