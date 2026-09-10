import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('payroll imports enforce HR scope, atomic validation, retry safety and audited corrections',async()=>{
  const db=new PGlite();
  const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',hr='00000000-0000-4000-8000-000000000003',manager='00000000-0000-4000-8000-000000000004';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated");
    for(const id of [owner,other,hr,manager])await db.query('insert into auth.users values($1,null)',[id]);
    for(const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0037_workforce_payroll_analysis'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);
    const employee=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic employee') returning id",[owner])).rows[0].id;
    await as(other);
    const foreign=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Other workspace') returning id",[other])).rows[0].id;
    await db.exec('reset role');
    await db.query("insert into workforce_members(owner_id,user_id,role,accepted_at) values($1,$2,'hr',now()),($1,$3,'manager',now())",[owner,hr,manager]);
    const row={employeeId:employee,periodStart:'2020-01-01',periodEnd:'2020-01-31',currency:'USD',grossMinor:10001,employerCostMinor:12001,paidHoursHundredths:16000,sourceReference:'source-1'};
    const load=(ref:string,rows:unknown[]=[row])=>db.query<{id:string}>('select workforce_import_payroll($1,$2,$3::jsonb) id',[owner,ref,JSON.stringify(rows)]);
    await as(owner);
    const batch=(await load('first')).rows[0].id;
    assert.equal((await load('first')).rows[0].id,batch);
    await assert.rejects(load('first',[{...row,grossMinor:10002}]));
    await assert.rejects(load('duplicate'));
    await assert.rejects(load('overlap',[{...row,periodStart:'2020-01-15',periodEnd:'2020-02-15'}]));
    const next={...row,periodStart:'2020-02-01',periodEnd:'2020-02-29'};
    await assert.rejects(load('foreign',[next,{...next,employeeId:foreign}]));
    assert.equal((await db.query('select * from workforce_payroll_imports')).rows.length,1);
    const invalid=[{...next,grossMinor:1.5},{...next,grossMinor:null},{...next,grossMinor:'100'},{...next,bank_account:'forbidden'},{...next,employerCostMinor:0},{...next,paidHoursHundredths:999999},{...next,currency:'XXX'},{...next,sourceReference:'=SUM(A1)'},{...next,periodStart:'02/01/2020'}];
    for(const r of invalid)await assert.rejects(load('invalid',[r]));
    const totals=()=>db.query<{gross_minor:string;employer_cost_minor:string}>('select * from workforce_payroll_totals($1)',[batch]);
    assert.equal(Number((await totals()).rows[0].gross_minor),10001);
    assert.equal(Number((await totals()).rows[0].employer_cost_minor),12001);
    await assert.rejects(db.query('update workforce_payroll_rows set gross_minor=0'),{code:'42501'});
    await assert.rejects(db.query('delete from workforce_payroll_history'),{code:'42501'});
    for(const id of [other,manager]){
      await as(id);
      for(const table of ['workforce_payroll_imports','workforce_payroll_rows','workforce_payroll_history'])assert.equal((await db.query(`select * from ${table}`)).rows.length,0);
      await assert.rejects(load('unauthorized'));await assert.rejects(totals());
      await assert.rejects(db.query("select workforce_void_payroll($1,'Not permitted')",[batch]));
    }
    await as(hr);assert.equal((await totals()).rows.length,1);
    await db.query("select workforce_void_payroll($1,'Source corrected')",[batch]);
    assert.equal((await totals()).rows.length,0);
    assert.equal((await db.query('select * from workforce_payroll_rows')).rows.length,1); // retained, not deleted
    await assert.rejects(load('first')); // cannot revive a voided batch through retry
    await load('corrected',[{...row,grossMinor:11001}]);
    assert.equal((await db.query('select * from workforce_payroll_history')).rows.length,3);
    await db.exec("reset role; create function fail_payroll_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger fail_payroll_audit before insert on workforce_payroll_history for each row execute function fail_payroll_audit()");
    await as(owner);await assert.rejects(load('audit-failure',[next]));
    assert.equal((await db.query('select * from workforce_payroll_imports')).rows.length,2);
    await db.exec('reset role; set role anon');await assert.rejects(load('anonymous'),{code:'42501'});
  }finally {await db.close();}
});
