import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('live reminders are personal, role scoped, current and count beyond display limits',async()=>{
  const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',employee='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated");
    for(const id of [owner,employee,outsider])await db.query('insert into auth.users values($1,null)',[id]);
    for(const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0032_workforce_business_setup','0039_workforce_reminders'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);
    const e=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic employee') returning id",[owner])).rows[0].id;
    await db.exec('reset role');await db.query("insert into workforce_members(owner_id,user_id,role,employee_id,accepted_at) values($1,$2,'employee',$3,now())",[owner,employee,e]);
    await as(owner);
    const t=(await db.query<{id:string}>("select workforce_assign_task($1,'training','Due task',$2,current_date) id",[e,employee])).rows[0].id;
    await db.query("select workforce_assign_task($1,'training','Far future',$2,current_date+60)",[e,employee]);
    const reminders=()=>db.query<{source_id:string;kind:string;total_count:string;business_timezone:string}>('select * from workforce_reminders($1)',[owner]);
    assert.equal((await reminders()).rows.length,0); // owner's queue does not claim employee's assigned task
    await as(employee);assert.equal((await reminders()).rows[0].source_id,t);assert.equal((await reminders()).rows[0].business_timezone,'UTC');
    await db.query("select workforce_finish_task($1,'Synthetic completion',false)",[t]);assert.equal((await reminders()).rows.length,0);
    await as(owner);assert.equal((await reminders()).rows[0].kind,'verify_task');
    await db.query("select workforce_finish_task($1,'Synthetic independent verification',true)",[t]);assert.equal((await reminders()).rows.length,0);
    await db.query("select workforce_assign_task($1,'training','Synthetic task '||i,$2,current_date) from generate_series(1,105) i",[e,employee]);
    await as(employee);const rows=(await reminders()).rows;assert.equal(rows.length,100);assert.equal(Number(rows[0].total_count),105);
    await as(outsider);await assert.rejects(reminders());
    await db.exec('reset role');await db.query('update workforce_members set revoked_at=now() where user_id=$1',[employee]);
    await as(employee);await assert.rejects(reminders());
    await db.exec('reset role; set role anon');await assert.rejects(reminders(),{code:'42501'});
  }finally {await db.close();}
});
