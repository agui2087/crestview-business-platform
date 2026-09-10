import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('reviewed accrual is opt-in, owner-only, capped, replay-safe and fail-closed', async()=>{
  const db=new PGlite();
  const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  try {
    await db.exec("create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table profiles(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated");
    await db.query('insert into auth.users values($1,null),($2,null)',[owner,other]);
    for(const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0034_workforce_schedules','0035_workforce_leave_ledger','0042_workforce_reviewed_accrual'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);
    const employee=(await db.query<{id:string}>("insert into employees(user_id,full_name) values($1,'Synthetic accrual worker') returning id",[owner])).rows[0].id;
    const policy=(await db.query<{id:string}>("select workforce_adopt_leave_policy($1,'Reviewed leave','2020-01-01','2200-12-31',600,1000,false,array[]::date[],'Synthetic review','manual_monthly') id",[employee])).rows[0].id;
    const configure=(version=0,amount=600,balance=500)=>db.query('select workforce_configure_accrual($1,1,$2,$3,$4,$5)',[policy,version,amount,balance,'Synthetic owner review']);
    await assert.rejects(configure()); // no opening
    await db.query("select workforce_post_leave_entry($1,current_date,'opening',500,'opening','Synthetic opening')",[policy]);
    await assert.rejects(configure(0,601));
    await assert.rejects(configure(0,600,499));
    assert.equal((await db.query('select * from workforce_accrual_rules')).rows.length,0);
    await configure();
    await assert.rejects(configure()); // stale rule version
    await assert.rejects(db.query('select workforce_run_accruals()'),{code:'42501'});
    await assert.rejects(db.query('update workforce_accrual_rules set enabled=false'),{code:'42501'});
    await as(other);assert.equal((await db.query('select * from workforce_accrual_rules')).rows.length,0);
    await assert.rejects(configure(1));await assert.rejects(db.query("select workforce_pause_accrual($1,1,'No access')",[policy]));
    await db.exec('reset role');
    assert.equal((await db.query<{n:number}>('select workforce_run_accruals() n')).rows[0].n,0); // future start
    // Synthetic fixture advances the due date; production runner has no date override.
    await db.query("update workforce_accrual_rules set next_on=date_trunc('month',now() at time zone 'UTC')::date where policy_id=$1",[policy]);
    await db.exec('select workforce_run_accruals(); select workforce_run_accruals()');
    let runs=(await db.query<{status:string;minutes:number}>('select status,minutes from workforce_accrual_runs')).rows;
    assert.equal(runs.length,1);assert.equal(runs[0].status,'posted');assert.equal(runs[0].minutes,500);
    assert.equal(Number((await db.query<{n:number}>('select sum(minutes) n from workforce_leave_ledger')).rows[0].n),1000);
    await as(owner);await db.query("select workforce_pause_accrual($1,1,'Owner pause')",[policy]);
    await assert.rejects(db.query("select workforce_pause_accrual($1,1,'Stale')",[policy]));
    assert.equal((await db.query<{enabled:boolean}>('select enabled from workforce_accrual_rules')).rows[0].enabled,false);
    await db.exec('reset role');assert.equal((await db.query<{n:number}>('select workforce_run_accruals() n')).rows[0].n,0);
    // Missed months pause rather than silently granting a catch-up entitlement.
    await db.query("update workforce_accrual_rules set enabled=true,next_on=(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date where policy_id=$1",[policy]);
    await db.exec('select workforce_run_accruals()');
    runs=(await db.query<{status:string;minutes:number}>('select status,minutes from workforce_accrual_runs order by id')).rows;
    assert.equal(runs[1].status,'review_required');
    assert.equal((await db.query<{enabled:boolean}>('select enabled from workforce_accrual_rules')).rows[0].enabled,false);
    // A separate policy with an existing manual monthly entry is never credited twice.
    await as(owner);
    const p2=(await db.query<{id:string}>("select workforce_adopt_leave_policy($1,'Other leave','2020-01-01','2200-12-31',600,1000,false,array[]::date[],'Synthetic review','manual_monthly') id",[employee])).rows[0].id;
    await db.query("select workforce_post_leave_entry($1,current_date,'opening',500,'opening','Synthetic opening')",[p2]);
    await db.query("select workforce_post_leave_entry($1,current_date,'accrual',100,'manual','Synthetic manual')",[p2]);
    await db.query("select workforce_configure_accrual($1,1,0,600,600,'Synthetic owner review')",[p2]);
    await db.exec('reset role');await db.query("update workforce_accrual_rules set next_on=date_trunc('month',now() at time zone 'UTC')::date where policy_id=$1",[p2]);
    await db.exec('select workforce_run_accruals()');
    assert.equal((await db.query<{status:string}>('select status from workforce_accrual_runs where policy_id=$1',[p2])).rows[0].status,'already_posted');
    assert.equal(Number((await db.query<{n:number}>('select sum(minutes) n from workforce_leave_ledger where policy_id=$1',[p2])).rows[0].n),600);
    // Audit failure rolls back both credit and due-date advancement.
    await as(owner);
    const p3=(await db.query<{id:string}>("select workforce_adopt_leave_policy($1,'Rollback leave','2020-01-01','2200-12-31',600,1000,false,array[]::date[],'Synthetic review','manual_monthly') id",[employee])).rows[0].id;
    await db.query("select workforce_post_leave_entry($1,current_date,'opening',1000,'opening','Synthetic opening')",[p3]);
    await db.query("select workforce_configure_accrual($1,1,0,600,1000,'Synthetic owner review')",[p3]);
    await db.exec('reset role');await db.query("update workforce_accrual_rules set next_on=date_trunc('month',now() at time zone 'UTC')::date where policy_id=$1",[p3]);
    await db.exec("create function fail_accrual_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit unavailable'; end $$; create trigger fail_accrual_audit before insert on workforce_history for each row execute function fail_accrual_audit()");
    await assert.rejects(db.exec('select workforce_run_accruals()'));
    assert.equal((await db.query('select * from workforce_accrual_runs where policy_id=$1',[p3])).rows.length,0);
    assert.equal((await db.query("select * from workforce_leave_ledger where policy_id=$1 and kind='accrual'",[p3])).rows.length,0);
    await db.exec('drop trigger fail_accrual_audit on workforce_history; select workforce_run_accruals()');
    assert.equal((await db.query<{minutes:number}>('select minutes from workforce_accrual_runs where policy_id=$1',[p3])).rows[0].minutes,0); // cap consumes this month
    await db.exec('set role anon');await assert.rejects(db.query('select workforce_run_accruals()'),{code:'42501'});await assert.rejects(configure(1));
  } finally {await db.close();}
});
