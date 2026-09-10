import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('schedules enforce scope, effective periods, versioning and immutable history',async()=>{
  const db=new PGlite();const owner='00000000-0000-4000-8000-000000000001',worker='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated");
    await db.query('insert into auth.users values($1,null),($2,null),($3,null)',[owner,worker,outsider]);
    for(const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0034_workforce_schedules'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);
    const e=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic worker') returning id",[owner])).rows[0].id;
    const save=(id:string|null,version:number,start='2026-09-01',end:string|null='2026-09-30',minutes:(number|null)[]=[480,480,480,480,480,0,0],zone='UTC',cancelled=false)=>db.query<{id:string}>('select workforce_save_schedule($1,$2,$3,$4,$5,$6,$7,$8,$9) id',[e,id,version,start,end,zone,minutes,'Reviewed plan',cancelled]);
    const s=(await save(null,0)).rows[0].id;
    await assert.rejects(save(null,0,'2026-09-30','2026-10-10')); // inclusive overlap
    await assert.rejects(save(s,0));
    await assert.rejects(save(null,0,'2026-10-01','2026-09-01'));
    await assert.rejects(save(null,0,'2026-10-01',null,[480]));
    await assert.rejects(save(null,0,'2026-10-01',null,[480,480,480,480,480,0,null]));
    await assert.rejects(save(null,0,'2026-10-01',null,[1441,0,0,0,0,0,0]));
    await assert.rejects(save(null,0,'2026-10-01',null,[480,0,0,0,0,0,0],'Invalid/Zone'));
    const next=(await save(null,0,'2026-10-01',null)).rows[0].id;
    await assert.rejects(save(s,1,'2026-09-01','2026-10-01'));
    await save(s,1,'2026-09-01','2026-09-30',[240,240,240,240,240,0,0]);
    const history=await db.query<{snapshot:{daily_minutes:number[]}}>('select snapshot from workforce_schedule_history where schedule_id=$1 order by id',[s]);
    assert.equal(history.rows.length,2);assert.equal(history.rows[0].snapshot.daily_minutes[0],480);assert.equal(history.rows[1].snapshot.daily_minutes[0],240);
    await assert.rejects(db.query('update workforce_schedules set cancelled=true'),{code:'42501'});
    await assert.rejects(db.query('delete from workforce_schedule_history'),{code:'42501'});
    await as(outsider);assert.equal((await db.query('select * from workforce_schedules')).rows.length,0);await assert.rejects(save(s,2));
    await db.exec('reset role');
    await db.query("insert into workforce_members(owner_id,user_id,role,employee_id,accepted_at) values($1,$2,'employee',$3,now())",[owner,worker,e]);
    await as(worker);assert.equal((await db.query('select * from workforce_schedules')).rows.length,2);await assert.rejects(save(s,2));
    await as(owner);await save(next,1,'2026-10-01',null,[480,480,480,480,480,0,0],'UTC',true);
    await save(null,0,'2026-10-01',null); // cancelled period can be replaced
    await db.exec("reset role; create function fail_schedule_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger fail_schedule_audit before insert on workforce_schedule_history for each row execute function fail_schedule_audit()");
    await as(owner);await assert.rejects(save(s,2));
    assert.equal((await db.query<{version:number}>('select version from workforce_schedules where id=$1',[s])).rows[0].version,2);
    await db.exec('reset role; set role anon');await assert.rejects(save(s,2),{code:'42501'});
  } finally {await db.close();}
});
