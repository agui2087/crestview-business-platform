import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {validDate} from './workforce.ts';

// Real application FormData handlers and database migrations. Only Next navigation,
// session transport and the Supabase query transport are replaced. Not browser E2E.
test('Workforce forms preserve session role isolation through actual database mutations',async(t)=>{
  const db=new PGlite();
  const ids=Array.from({length:6},(_,i)=>`10000000-0000-4000-8000-00000000000${i+1}`);
  const [owner,hr,manager,employee,outsider,unassigned]=ids;
  let session:string|null=owner;
  const invalidated:string[]=[];
  class Navigation extends Error {location:string;constructor(location:string){super('redirect');this.location=location;}}
  const as=async(id:string|null)=>{session=id;await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`set role ${id?'authenticated':'anon'}`);};
  const transport={auth:{getUser:async()=>({data:{user:session?{id:session}:null}})},rpc:async(name:string,args:Record<string,unknown>)=>{
    assert.match(name,/^workforce_[a-z_]+$/);
    const keys=Object.keys(args);keys.forEach(k=>assert.match(k,/^p_[a-z_]+$/));
    try {const r=await db.query<{value:unknown}>(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as value`,Object.values(args));return {data:r.rows[0]?.value,error:null};}
    catch(error){return {data:null,error};}
  }};
  const load=async(path:string,name:string)=>{
    const source=await readFile(new URL(path,import.meta.url),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const exports:Record<string,(form:FormData)=>Promise<void>>={};
    runInNewContext(code,{exports,require:(id:string)=>{
      if(id==='next/navigation')return {redirect:(location:string)=>{throw new Navigation(location);}};
      if(id==='next/cache')return {revalidatePath:(path:string)=>invalidated.push(path)};
      if(id==='@/lib/i18n')return {isLocale:(s:string)=>['en','es'].includes(s)};
      if(id==='@/lib/workforce')return {validDate};
      if(id==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>transport};
      throw new Error(`Unexpected import ${id}`);
    }});
    return exports[name];
  };
  const run=async(action:(f:FormData)=>Promise<void>,values:Record<string,string>,saved:boolean)=>{
    const f=new FormData();Object.entries({locale:'en',owner,...values}).forEach(([k,v])=>f.set(k,v));
    await assert.rejects(action(f),(e:unknown)=>e instanceof Navigation&&e.location.endsWith(`notice=${saved?'saved':'failed'}`));
  };
  const one=async(sql:string,values:unknown[]=[]) => (await db.query<Record<string,unknown>>(sql,values)).rows[0];
  try {
    await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create table public.profiles(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
    for(let i=0;i<ids.length;i++)await db.query('insert into auth.users values($1,$2)',[ids[i],`form-${i}@example.test`]);
    for(const migration of ['0008_workforce_and_organizations','0029_workforce_record_integrity','0030_workforce_operations','0031_workforce_checklist_management','0035_workforce_leave_ledger','0040_workforce_leave_carryover'])await db.exec(await readFile(new URL(`../supabase/migrations/${migration}.sql`,import.meta.url),'utf8'));
    const operation=await load('../app/[locale]/dashboard/workforce/operations/actions.ts','workforceOperation');
    const leave=await load('../app/[locale]/dashboard/workforce/leave/actions.ts','leaveOperation');
    await as(owner);
    const e=String((await one("insert into employees(user_id,full_name) values($1,'Isolated form employee') returning id",[owner])).id);
    let employeeMembership='';
    await t.test('invitation and acceptance forms use authenticated identity, not submitted owner',async()=>{
      for(const [index,role] of [[1,'hr'],[2,'manager'],[3,'employee'],[5,'manager']] as const){
        await as(owner);await run(operation,{operation:'invite',email:`form-${index}@example.test`,role,employee:role==='employee'?e:''},true);
        const id=String((await one('select id from workforce_members where user_id=$1',[ids[index]])).id);
        if(role==='employee')employeeMembership=id;
        await as(outsider);await run(operation,{operation:'accept',id},false);
        await as(ids[index]);await run(operation,{operation:'accept',id},true);
      }
      await as(owner);await db.query("select workforce_update_employee($1,1,jsonb_build_object('manager_user_id',$2::text))",[e,manager]);
    });
    await t.test('employee leave form rejects self approval and unassigned managers',async()=>{
      await as(employee);await run(operation,{operation:'leave',employee:e,title:'Reviewed absence',start:'2020-01-06',end:'2020-01-06',leave_type:'Custom'},true);
      const id=String((await one('select id from workforce_requests where employee_id=$1',[e])).id);
      for(const actor of [employee,outsider,unassigned]){await as(actor);await run(operation,{operation:'decide',id,status:'approved',reason:'Unauthorized'},false);}
      await as(manager);await run(operation,{operation:'decide',id,status:'approved',reason:'Coverage reviewed'},true);
      await run(operation,{operation:'decide',id,status:'rejected',reason:'Stale page'},false);
      assert.equal((await one('select status from workforce_requests where id=$1',[id])).status,'approved');
    });
    await t.test('assignment, completion and independent verification form chain',async()=>{
      const values={operation:'task',employee:e,category:'training',title:'Isolated training',assignee:employee,due:'2020-02-01'};
      await as(unassigned);await run(operation,values,false);
      await as(manager);await run(operation,values,true);
      const id=String((await one('select id from workforce_tasks where employee_id=$1',[e])).id);
      await as(employee);await run(operation,{operation:'complete',id,evidence:'Completed synthetic training'},true);
      await run(operation,{operation:'verify',id},false);
      await as(hr);await run(operation,{operation:'verify',id},true);
      assert.ok((await one('select verified_at from workforce_tasks where id=$1',[id])).verified_at);
    });
    await t.test('reviewed leave forms require confirmation and prevent double transfer',async()=>{
      await as(hr);
      const policy={operation:'adopt',employee:e,type:'Custom',start:'2020-01-01',end:'2020-12-31',accrual:'60',cap:'600',exclude:'false',review:'Synthetic reviewed policy',cadence:'manual_monthly'};
      await run(leave,policy,false);await run(leave,{...policy,confirmed:'yes'},true);
      const source=String((await one('select id from workforce_leave_policies where starts_on=$1',['2020-01-01'])).id);
      await run(leave,{operation:'post',policy:source,date:'2020-01-01',kind:'opening',minutes:'480',reference:'form-opening',reason:'Reviewed opening'},true);
      await run(leave,{...policy,start:'2021-01-01',end:'2021-12-31',confirmed:'yes'},true);
      const target=String((await one('select id from workforce_leave_policies where starts_on=$1',['2021-01-01'])).id);
      const transfer={operation:'transfer',policy:source,target:`${target}:1`,version:'1',expected_balance:'480',minutes:'240',reason:'Reviewed carryover'};
      await run(leave,transfer,false);
      await as(employee);await run(leave,{...transfer,confirmed:'yes'},false);
      await as(hr);await run(leave,{...transfer,confirmed:'yes'},true);await run(leave,{...transfer,confirmed:'yes'},true);
      assert.equal((await one('select count(*)::int n from workforce_leave_transfers')).n,1);
      assert.equal((await one('select minutes from workforce_leave_balance($1,current_date)',[source])).minutes,240);
    });
    await t.test('revoked member and signed-out form calls cannot mutate',async()=>{
      await as(owner);await run(operation,{operation:'revoke',id:employeeMembership},true);
      await as(employee);await run(operation,{operation:'leave',employee:e,title:'No access',start:'2020-01-07',end:'2020-01-07',leave_type:'Custom'},false);
      await as(null);const f=new FormData();f.set('operation','invite');f.set('owner',owner);
      await assert.rejects(operation(f),(e:unknown)=>e instanceof Navigation&&e.location==='/en/sign-in');
      await assert.rejects(leave(f),(e:unknown)=>e instanceof Navigation&&e.location==='/en/sign-in');
      assert.ok(invalidated.includes('/en/dashboard/workforce/operations'));assert.ok(invalidated.includes('/en/dashboard/workforce/leave'));
    });
  } finally {await db.close();}
});
