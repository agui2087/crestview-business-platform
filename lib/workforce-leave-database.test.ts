import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('leave postings are scoped, append-only, idempotent and capped',async()=>{
  const db=new PGlite();const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated");
    await db.query('insert into auth.users values($1,null),($2,null)',[owner,other]);
    for(const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0034_workforce_schedules','0035_workforce_leave_ledger','0036_workforce_leave_request_posting'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);
    const e=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic worker') returning id",[owner])).rows[0].id;
    const adopt=()=>db.query<{id:string}>("select workforce_adopt_leave_policy($1,'Custom leave','2020-01-01','2020-12-31',600,1000,true,array[]::date[],'Synthetic reviewed policy','manual_monthly') id",[e]);
    const p=(await adopt()).rows[0].id;await assert.rejects(adopt());
    const balance=()=>db.query<{configured:boolean;minutes:number|null}>('select * from workforce_leave_balance($1,$2)',[p,'2020-12-31']);
    assert.equal((await balance()).rows[0].configured,false);
    assert.equal((await balance()).rows[0].minutes,null);
    const post=(kind:string,minutes:number,reference:string,date='2020-02-01')=>db.query<{id:string}>('select workforce_post_leave_entry($1,$2,$3,$4,$5,$6) id',[p,date,kind,minutes,reference,'Reviewed synthetic posting']);
    await assert.rejects(post('accrual',600,'jan'));
    await post('opening',500,'migration','2020-01-01');
    await assert.rejects(post('opening',0,'another-opening'));
    await assert.rejects(post('accrual',600,'feb')); // cap
    const entry=(await post('accrual',500,'feb')).rows[0].id;
    assert.equal((await post('accrual',500,'feb')).rows[0].id,entry);
    await assert.rejects(post('accrual',499,'feb'));
    await assert.rejects(post('taken',100,'leave'));
    await post('taken',-480,'leave');
    await assert.rejects(post('accrual',1,'different-feb-reference'));
    assert.equal(Number((await balance()).rows[0].minutes),520);
    await assert.rejects(db.query("select workforce_close_leave_policy($1,1,'2020-01-31','Would remove entries')",[p]));
    await db.query("select workforce_close_leave_policy($1,1,'2020-06-30','Reviewed end date')",[p]);
    await assert.rejects(db.query("select workforce_close_leave_policy($1,1,'2020-05-31','Stale end date')",[p]));
    assert.equal((await db.query('select * from workforce_leave_policy_history')).rows.length,2);
    await db.query("select workforce_post_leave_entry($1,'2020-02-01','adjustment',1,'bulk-'||i,'Synthetic aggregation check') from generate_series(1,600) i",[p]);
    assert.equal(Number((await balance()).rows[0].minutes),1120); // beyond UI/REST page limits
    await assert.rejects(post('adjustment',1,'backdated','2020-01-31'));
    await assert.rejects(post('adjustment',1,'outside','2021-01-01'));
    assert.equal((await db.query<{balance:string}>('select sum(minutes)::text balance from workforce_leave_ledger')).rows[0].balance,'1120');
    await assert.rejects(db.query('update workforce_leave_ledger set minutes=0'),{code:'42501'});
    await assert.rejects(db.query('delete from workforce_leave_policies'),{code:'42501'});
    await as(other);assert.equal((await db.query('select * from workforce_leave_policies')).rows.length,0);assert.equal((await db.query('select * from workforce_leave_ledger')).rows.length,0);await assert.rejects(post('adjustment',1,'hijack'));await assert.rejects(balance());
    await db.exec('reset role');
    const request=(await db.query<{id:string}>("insert into workforce_requests(owner_id,employee_id,kind,title,starts_on,ends_on,leave_type,status,approver_id,created_by) values($1,$2,'leave','Synthetic leave','2020-02-03','2020-02-03','Custom leave','approved',$1,$3) returning id",[owner,e,other])).rows[0].id;
    const debit=(expected=480)=>db.query<{id:string}>("select workforce_post_approved_leave($1,$2,2,$3,'2020-02-03','Reviewed completed leave') id",[request,p,expected]);
    await as(other);await assert.rejects(debit());
    await as(owner);await assert.rejects(debit()); // schedule absent, never treated as zero
    const schedule=(await db.query<{id:string}>("select workforce_save_schedule($1,null,0,'2020-01-01','2020-12-31','UTC',array[480,480,480,480,480,0,0],'Reviewed schedule') id",[e])).rows[0].id;
    await assert.rejects(debit(479));
    const posted=(await debit()).rows[0].id;assert.equal((await debit()).rows[0].id,posted);
    assert.equal(Number((await balance()).rows[0].minutes),640);
    await db.query("select workforce_save_schedule($1,$2,1,'2020-01-01','2020-12-31','UTC',array[240,240,240,240,240,0,0],'Future review')",[e,schedule]);
    assert.equal((await debit()).rows[0].id,posted); // old calculation preserved after schedule change
    const snapshot=(await db.query<{calculation:{minutes:number;days:{minutes:number}[]}}>('select calculation from workforce_leave_request_postings')).rows[0].calculation;
    assert.equal(snapshot.minutes,480);assert.equal(snapshot.days[0].minutes,480);
    await assert.rejects(debit(240));
    await assert.rejects(db.query("update workforce_leave_request_postings set calculation='{}'"),{code:'42501'});
    await db.exec("reset role; create function fail_leave_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger fail_leave_audit before insert on workforce_history for each row execute function fail_leave_audit()");
    await as(owner);await assert.rejects(post('adjustment',1,'audit-failure','2020-02-03'));
    assert.equal((await db.query('select * from workforce_leave_ledger')).rows.length,604);
    await db.exec('reset role; set role anon');await assert.rejects(post('adjustment',1,'anon'),{code:'42501'});
  }finally {await db.close();}
});
