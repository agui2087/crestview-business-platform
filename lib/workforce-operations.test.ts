import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Workforce operations: permissions, lifecycle, requests, tasks and revocation', async (t) => {
  const db = new PGlite();
  const ids = Array.from({length:5},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
  const [owner,hr,manager,employee,outsider] = ids;
  const as = async (id: string) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
  const one = async (sql: string, values: unknown[] = []) => (await db.query<Record<string,unknown>>(sql,values)).rows[0];
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key,email text); create table public.profiles(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated;`);
    for (let i=0;i<ids.length;i++) await db.query('insert into auth.users values($1,$2)',[ids[i],`person${i}@example.com`]);
    for (const name of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
    await as(owner);
    const e = String((await one("insert into employees(user_id,full_name) values($1,'Test employee') returning id",[owner])).id);
    const other = String((await one("insert into employees(user_id,full_name) values($1,'Other team') returning id",[owner])).id);
    let hrMembership = '', employeeMembership = '';
    await t.test('invited accounts have no access until they accept',async()=>{
      hrMembership=String((await one("select workforce_invite($1,'person1@example.com','hr',null) id",[owner])).id);
      const m=String((await one("select workforce_invite($1,'person2@example.com','manager',null) id",[owner])).id);
      employeeMembership=String((await one("select workforce_invite($1,'person3@example.com','employee',$2) id",[owner,e])).id);
      await as(hr); assert.equal((await db.query('select id from employees')).rows.length,0);
      await db.query('select workforce_membership_decision($1,true)',[hrMembership]);
      await as(manager); await db.query('select workforce_membership_decision($1,true)',[m]);
      await as(employee); await db.query('select workforce_membership_decision($1,true)',[employeeMembership]);
    });
    await t.test('owner assigns manager; employee sees only self; manager sees only assigned team',async()=>{
      await as(owner); await db.query("select workforce_update_employee($1,1,jsonb_build_object('manager_user_id',$2::text))",[e,manager]);
      await as(manager); assert.deepEqual((await db.query<{id:string}>('select id from employees')).rows.map(x=>x.id),[e]);
      await as(employee); assert.deepEqual((await db.query<{id:string}>('select id from employees')).rows.map(x=>x.id),[e]);
      await assert.rejects(db.query('select notes from employees'),{code:'42501'});
      await as(outsider); assert.equal((await db.query('select id from employees')).rows.length,0);
    });
    await t.test('outsiders and employees cannot edit profiles or grant access',async()=>{
      for(const id of [outsider,employee,manager]) { await as(id); await assert.rejects(db.query("select workforce_update_employee($1,2,'{\"department\":\"Wrong\"}')",[e])); await assert.rejects(db.query("select workforce_invite($1,'person4@example.com','hr',null)",[owner])); }
    });
    await t.test('HR edits are versioned and audited; stale edits are rejected',async()=>{
      await as(hr); await db.query("select workforce_update_employee($1,2,'{\"department\":\"Operations\"}')",[e]);
      await assert.rejects(db.query("select workforce_update_employee($1,2,'{\"department\":\"Stale\"}')",[e]));
      assert.equal((await one('select department from employees where id=$1',[e])).department,'Operations');
      assert.equal((await db.query('select id from workforce_history where employee_id=$1',[e])).rows.length,3);
      await assert.rejects(db.query('delete from workforce_history'),{code:'42501'});
    });
    await t.test('employee requests leave; cannot self approve; assigned manager can decide once',async()=>{
      await as(employee);
      const r=String((await one("select workforce_submit_request($1,'leave','Vacation','2026-10-01','2026-10-03','Vacation') id",[e])).id);
      await assert.rejects(db.query("select workforce_decide_request($1,'approved','Self')",[r]));
      await as(outsider); await assert.rejects(db.query("select workforce_decide_request($1,'approved','Wrong')",[r]));
      await as(manager); await db.query("select workforce_decide_request($1,'approved','Coverage reviewed')",[r]);
      await assert.rejects(db.query("select workforce_decide_request($1,'rejected','Stale')",[r]));
      assert.equal((await one('select status from workforce_requests where id=$1',[r])).status,'approved');
    });
    await t.test('profile requests only accept safe fields and require HR review',async()=>{
      await as(employee);
      await assert.rejects(db.query("select workforce_submit_request($1,'profile','Escalate',null,null,null,'{\"user_id\":\"bad\"}')",[e]));
      const r=String((await one("select workforce_submit_request($1,'profile','Contact update',null,null,null,'{\"phone\":\"555-0100\"}') id",[e])).id);
      await as(manager); await assert.rejects(db.query("select workforce_decide_request($1,'approved','Reviewed')",[r]));
      await as(hr); await db.query("select workforce_decide_request($1,'approved','Reviewed')",[r]);
      assert.equal((await one('select phone from employees where id=$1',[e])).phone,'555-0100');
    });
    await t.test('tasks require authorized assignees and separate completion from verification',async()=>{
      await as(manager);
      await assert.rejects(db.query("select workforce_assign_task($1,'training','Safety',$2,'2026-10-01')",[e,outsider]));
      const task=String((await one("select workforce_assign_task($1,'training','Safety',$2,'2026-10-01') id",[e,employee])).id);
      await as(employee); await db.query("select workforce_finish_task($1,'Completed assigned safety module',false)",[task]);
      await assert.rejects(db.query("select workforce_finish_task($1,'',true)",[task]));
      await as(manager); await db.query("select workforce_finish_task($1,'',true)",[task]);
      assert.ok((await one('select verified_at from workforce_tasks where id=$1',[task])).verified_at);
      await assert.rejects(db.query("select workforce_assign_task($1,'training','Other team',$2,'2026-10-01')",[other,manager]));
    });
    await t.test('starter checklists are atomic and cannot duplicate an open checklist',async()=>{
      await as(owner);
      assert.equal((await one("select workforce_start_checklist($1,'onboarding','2026-10-01',$2) count",[e,employee])).count,5);
      await assert.rejects(db.query("select workforce_start_checklist($1,'onboarding','2026-10-01',$2)",[e,employee]));
      assert.equal((await db.query("select id from workforce_tasks where category='onboarding'")).rows.length,5);
      await assert.rejects(db.query("select workforce_start_checklist($1,'offboarding','2026-10-01',$2)",[e,outsider]));
      assert.equal((await db.query("select id from workforce_tasks where category='offboarding'")).rows.length,0);
    });
    await t.test('requirements enforce role matching and reject duplicate open assignments without stray tasks',async()=>{
      await as(owner);
      const version=(await one('select version from employees where id=$1',[e])).version;
      await db.query("select workforce_update_employee($1,$2,'{\"position\":\"Operator\"}')",[e,version]);
      const rule=String((await one("select workforce_add_requirement($1,'Operator','Safety renewal',365) id",[owner])).id);
      await db.query("select workforce_assign_requirement($1,$2,'2026-10-01',$3)",[e,rule,employee]);
      await assert.rejects(db.query("select workforce_assign_requirement($1,$2,'2026-10-01',$3)",[e,rule,employee]));
      assert.equal((await db.query("select id from workforce_tasks where title='Safety renewal'")).rows.length,1);
      await assert.rejects(db.query("select workforce_assign_requirement($1,$2,'2026-10-01',$3)",[other,rule,owner]));
      await as(employee); await assert.rejects(db.query("select workforce_add_requirement($1,'Operator','Unauthorized',365)",[owner]));
    });
    await t.test('audit failures roll back employee changes',async()=>{
      await as(owner);
      const version=(await one('select version from employees where id=$1',[e])).version;
      await db.exec("reset role; alter table workforce_history add constraint injected_audit_failure check(action <> 'UPDATE') not valid");
      await as(owner); await assert.rejects(db.query("select workforce_update_employee($1,$2,'{\"department\":\"Should roll back\"}')",[e,version]));
      assert.equal((await one('select department from employees where id=$1',[e])).department,'Operations');
      await db.exec('reset role; alter table workforce_history drop constraint injected_audit_failure');
    });
    await t.test('archive preserves history and prevents new requests; revocation removes access',async()=>{
      await as(owner); const version=(await one('select version from employees where id=$1',[e])).version;
      await db.query("select workforce_update_employee($1,$2,'{\"archived\":true}')",[e,version]);
      await as(employee); await assert.rejects(db.query("select workforce_submit_request($1,'leave','Vacation','2026-10-01','2026-10-03','Vacation')",[e]));
      await as(owner); await db.query('select workforce_membership_decision($1,false)',[employeeMembership]);
      await as(employee); assert.equal((await db.query('select id from employees')).rows.length,0); assert.equal((await db.query('select id from workforce_tasks')).rows.length,0);
    });
  } finally { await db.close(); }
});
