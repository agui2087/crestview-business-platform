import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('business configuration is tenant scoped, versioned and rejects unauthorized writes',async()=>{
  const db=new PGlite();
  const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated");
    await db.query('insert into auth.users values($1,null),($2,null)',[owner,other]);
    for(const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0031_workforce_checklist_management','0032_workforce_business_setup','0033_workforce_employee_placement'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);
    await db.query("select workforce_save_business($1,0,'Example business','America/Los_Angeles')",[owner]);
    await assert.rejects(db.query("select workforce_save_business($1,0,'Stale','UTC')",[owner]));
    await assert.rejects(db.query("select workforce_save_business($1,1,'Wrong zone','Invalid/Zone')",[owner]));
    const location=(await db.query<{id:string}>("select workforce_save_location($1,null,0,'Office','US','California','America/Los_Angeles') id",[owner])).rows[0].id;
    const department=(await db.query<{id:string}>("select workforce_save_department($1,null,0,'Operations') id",[owner])).rows[0].id;
    const employee=(await db.query<{id:string}>("insert into employees(user_id,full_name,department) values($1,'Example worker','Legacy label') returning id",[owner])).rows[0].id;
    await db.query('select workforce_set_placement($1,0,$2,$3)',[employee,location,department]);
    await assert.rejects(db.query('select workforce_set_placement($1,0,null,null)',[employee]));
    await assert.rejects(db.query('update workforce_employee_placements set location_id=null'),{code:'42501'});
    assert.equal((await db.query<{department:string}>('select department from employees where id=$1',[employee])).rows[0].department,'Legacy label');
    await as(other);
    assert.equal((await db.query('select * from workforce_business_settings')).rows.length,0);
    assert.equal((await db.query('select * from workforce_locations')).rows.length,0);
    assert.equal((await db.query('select * from workforce_employee_placements')).rows.length,0);
    await assert.rejects(db.query('select workforce_set_placement($1,1,null,null)',[employee]));
    const foreignLocation=(await db.query<{id:string}>("select workforce_save_location($1,null,0,'Other office','US','CA','UTC') id",[other])).rows[0].id;
    await assert.rejects(db.query("select workforce_save_business($1,1,'Hijack','UTC')",[owner]));
    await assert.rejects(db.query("select workforce_save_location($1,$2,1,'Hijack','US','CA','UTC')",[other,location]));
    await assert.rejects(db.query("select workforce_save_department($1,$2,1,'Hijack')",[other,department]));
    await as(owner);
    await assert.rejects(db.query('select workforce_set_placement($1,1,$2,$3)',[employee,foreignLocation,department]));
    await db.query("select workforce_save_department($1,$2,1,'Operations',true)",[owner,department]);
    await assert.rejects(db.query('select workforce_set_placement($1,1,$2,$3)',[employee,location,department]));
    await db.query('select workforce_set_placement($1,1,null,null)',[employee]);
    assert.equal((await db.query<{version:number}>('select version from workforce_employee_placements')).rows[0].version,2);
    await db.query("select workforce_update_employee($1,1,'{\"archived\":true}')",[employee]);
    await assert.rejects(db.query('select workforce_set_placement($1,2,$2,null)',[employee,location]));
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select workforce_set_placement($1,2,null,null)',[employee]),{code:'42501'});
    await as(owner);
    await assert.rejects(db.query("select workforce_save_department($1,$2,1,'Stale')",[owner,department]));
    await assert.rejects(db.query("update workforce_departments set name='Bypass'"),{code:'42501'});
    assert.equal((await db.query('select * from workforce_setup_history')).rows.length,4);
  } finally {await db.close();}
});
