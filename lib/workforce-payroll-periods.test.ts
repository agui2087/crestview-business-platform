import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('payroll period analytics aggregate all batches before limits and preserve currency, void and role boundaries',async()=>{
  const db=new PGlite();
  const owner='20000000-0000-4000-8000-000000000001',hr='20000000-0000-4000-8000-000000000002',manager='20000000-0000-4000-8000-000000000003',other='20000000-0000-4000-8000-000000000004';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const periods=()=>db.query<{currency:string;employees:number;imports:number;gross_minor:string;employer_cost_minor:string;paid_hours_hundredths:number;cost_per_paid_hour:string|null;total_periods:number}>('select * from workforce_payroll_periods($1)',[owner]);
  try {
    await db.exec("create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create table profiles(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;");
    for(const id of [owner,hr,manager,other])await db.query('insert into auth.users values($1,null)',[id]);
    for(const m of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0037_workforce_payroll_analysis','0041_workforce_payroll_periods'])await db.exec(await readFile(new URL(`../supabase/migrations/${m}.sql`,import.meta.url),'utf8'));
    // Fixture inserts are privileged and isolated, never sent to a hosted database.
    await db.query("insert into workforce_members(owner_id,user_id,role,accepted_at) values($1,$2,'hr',now()),($1,$3,'manager',now())",[owner,hr,manager]);
    await db.query("insert into employees(user_id,full_name) select $1,'Fixture '||n from generate_series(1,510) n",[owner]);
    await db.query("insert into workforce_payroll_imports(owner_id,reference,payload,created_by) select $1,'Batch '||n,'[]',$1 from generate_series(1,51) n",[owner]);
    await db.query(`with es as(select id,row_number() over(order by id) n from employees), bs as(select id,row_number() over(order by id) n from workforce_payroll_imports)
      insert into workforce_payroll_rows(import_id,owner_id,employee_id,period_start,period_end,currency,gross_minor,employer_cost_minor,paid_hours_hundredths,source_reference)
      select bs.id,$1,es.id,'2020-01-01','2020-01-31','USD',100,120,200,'fixture' from es join bs on bs.n=(es.n-1)/10+1`,[owner]);
    await as(owner);let rows=(await periods()).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].employees,510);assert.equal(rows[0].imports,51);assert.equal(Number(rows[0].gross_minor),51000);assert.equal(Number(rows[0].cost_per_paid_hour),0.6);
    const batch=(await db.query<{id:string}>('select id from workforce_payroll_imports limit 1')).rows[0].id;
    await db.query("select workforce_void_payroll($1,'Reviewed correction')",[batch]);
    rows=(await periods()).rows;assert.equal(rows[0].employees,500);assert.equal(rows[0].imports,50);assert.equal(Number(rows[0].gross_minor),50000);
    await db.exec('reset role');
    await db.query(`insert into workforce_payroll_rows(import_id,owner_id,employee_id,period_start,period_end,currency,gross_minor,employer_cost_minor,paid_hours_hundredths,source_reference)
      select b.id,$1,e.id,'2020-02-01','2020-02-29','EUR',100,120,0,'zero hours' from workforce_payroll_imports b cross join employees e where b.voided_at is null limit 1`,[owner]);
    await as(hr);rows=(await periods()).rows;assert.equal(rows.length,2);assert.equal(rows[0].currency,'EUR');assert.equal(rows[0].cost_per_paid_hour,null);assert.equal(rows[1].currency,'USD');
    for(const id of [manager,other]){await as(id);await assert.rejects(periods());}
    await db.exec('reset role');
    await db.query(`insert into workforce_payroll_rows(import_id,owner_id,employee_id,period_start,period_end,currency,gross_minor,employer_cost_minor,paid_hours_hundredths,source_reference)
      select b.id,$1,e.id,date '2021-01-01'+n,date '2021-01-01'+n,'USD',100,120,100,'day '||n from generate_series(1,105) n cross join lateral(select id from employees limit 1)e cross join lateral(select id from workforce_payroll_imports where voided_at is null limit 1)b`,[owner]);
    await as(owner);rows=(await periods()).rows;assert.equal(rows.length,100);assert.equal(rows[0].total_periods,107);
    await db.exec('reset role');await db.query('update workforce_members set revoked_at=now() where user_id=$1',[hr]);
    await as(hr);await assert.rejects(periods());
    await db.exec('reset role;set role anon');await assert.rejects(periods(),{code:'42501'});
  }finally{await db.close();}
});
