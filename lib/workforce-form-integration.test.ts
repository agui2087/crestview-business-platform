import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {validDate} from './workforce.ts';
import {parsePayrollCsv} from './workforce-payroll.ts';

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
    try {const r=await db.query<{value:unknown}>(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as value`,keys.map(k=>k==='p_rows'?JSON.stringify(args[k]):args[k]));return {data:r.rows[0]?.value,error:null};}
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
      if(id==='@/lib/workforce-payroll')return {parsePayrollCsv};
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
    await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create table public.profiles(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
    for(let i=0;i<ids.length;i++)await db.query('insert into auth.users values($1,$2)',[ids[i],`form-${i}@example.test`]);
    for(const migration of ['0008_workforce_and_organizations','0018_private_document_vault','0021_vault_uuid_ownership','0029_workforce_record_integrity','0030_workforce_operations','0031_workforce_checklist_management','0035_workforce_leave_ledger','0037_workforce_payroll_analysis','0040_workforce_leave_carryover'])await db.exec(await readFile(new URL(`../supabase/migrations/${migration}.sql`,import.meta.url),'utf8'));
    await db.exec('alter table vault_documents add column security_status text,add column scan_sha256 text');
    await db.exec(await readFile(new URL('../supabase/migrations/0038_workforce_training_evidence.sql',import.meta.url),'utf8'));
    const operation=await load('../app/[locale]/dashboard/workforce/operations/actions.ts','workforceOperation');
    const leave=await load('../app/[locale]/dashboard/workforce/leave/actions.ts','leaveOperation');
    const evidence=await load('../app/[locale]/dashboard/workforce/evidence/actions.ts','evidenceOperation');
    const importAction=await load('../app/[locale]/dashboard/workforce/payroll/actions.ts','importPayroll');
    const importPayroll=(form:FormData)=>(importAction as unknown as (previous:{error:string},form:FormData)=>Promise<{error:string}>)({error:''},form);
    const voidPayroll=await load('../app/[locale]/dashboard/workforce/payroll/actions.ts','voidPayroll');
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
    await t.test('payroll form revalidates source data, scope, review and whole-batch corrections',async()=>{
      const form=new FormData();Object.entries({locale:'en',owner,reference:'form-payroll',csv:`employee_id,period_start,period_end,currency,gross_pay,employer_cost,paid_hours,source_reference\n${e},2020-01-01,2020-01-31,USD,100.01,120.01,8.00,synthetic`}).forEach(([k,v])=>form.set(k,v));
      await as(owner);assert.match((await importPayroll(form)).error,/review/i);
      form.set('reviewed','yes');
      for(const actor of [employee,manager,unassigned,outsider]){await as(actor);assert.match((await importPayroll(form)).error,/denied/i);}
      await as(hr);await assert.rejects(importPayroll(form),(e:unknown)=>e instanceof Navigation&&e.location.endsWith('notice=saved'));
      await assert.rejects(importPayroll(form),(e:unknown)=>e instanceof Navigation&&e.location.endsWith('notice=saved'));
      const batch=String((await one('select id from workforce_payroll_imports')).id);
      assert.equal((await one('select count(*)::int n from workforce_payroll_rows')).n,1);
      form.set('reference','duplicate-period');assert.match((await importPayroll(form)).error,/Not saved/);
      const csv=String(form.get('csv'));form.set('csv','bank_account\nforbidden');assert.match((await importPayroll(form)).error,/Invalid CSV/);form.set('csv',csv);
      const correction=new FormData();Object.entries({locale:'en',owner,batch,reason:'Reviewed source correction'}).forEach(([k,v])=>correction.set(k,v));
      await assert.rejects(voidPayroll(correction),(e:unknown)=>e instanceof Navigation&&e.location.endsWith('notice=failed'));
      correction.set('confirmed','yes');await as(manager);await assert.rejects(voidPayroll(correction),(e:unknown)=>e instanceof Navigation&&e.location.endsWith('notice=failed'));
      await as(hr);await assert.rejects(voidPayroll(correction),(e:unknown)=>e instanceof Navigation&&e.location.endsWith('notice=voided'));
      assert.ok((await one('select voided_at from workforce_payroll_imports where id=$1',[batch])).voided_at);
      assert.equal((await one('select count(*)::int n from workforce_payroll_rows')).n,1);
      await assert.rejects(importPayroll(form),(e:unknown)=>e instanceof Navigation&&e.location.endsWith('notice=saved'));
      assert.equal((await one('select count(*)::int n from workforce_payroll_rows where voided_at is null')).n,1);
    });
    await t.test('evidence form requires explicit review, own screened revision and authorized revocation',async()=>{
      await as(manager);await run(operation,{operation:'task',employee:e,category:'training',title:'Evidence form task',assignee:employee,due:'2020-02-01'},true);
      const task=String((await one("select id from workforce_tasks where title='Evidence form task'")).id);
      await db.exec('reset role');
      const document=String((await one("insert into vault_documents(id,owner_key,owner_id,storage_key,original_name,content_type,size_bytes,security_status,scan_sha256) values(gen_random_uuid(),'uuid-owned',$1,'isolated/form.pdf','synthetic.pdf','application/pdf',10,'blocked',repeat('a',64)) returning id",[employee])).id);
      const share={operation:'share',task,document,version:'1'};
      await as(employee);await run(evidence,share,false);await run(evidence,{...share,confirmed:'yes'},false);
      await db.exec('reset role');await db.query("update vault_documents set security_status='malware_scanned' where id=$1",[document]);
      for(const actor of [owner,outsider,unassigned]){await as(actor);await run(evidence,{...share,confirmed:'yes'},false);}
      await as(employee);await run(evidence,{...share,version:'99',confirmed:'yes'},false);
      await run(evidence,{...share,confirmed:'yes'},true);await run(evidence,{...share,confirmed:'yes'},true);
      const id=String((await one('select id from workforce_training_evidence')).id);assert.equal((await one('select count(*)::int n from workforce_training_evidence')).n,1);
      await as(outsider);await run(evidence,{operation:'revoke',task,evidence:id,reason:'Unauthorized',confirmed:'yes'},false);
      await as(hr);await run(evidence,{operation:'revoke',task,evidence:id,reason:'Review withdrawn',confirmed:'yes'},true);
      assert.equal((await one('select workforce_training_evidence_available($1) ok',[id])).ok,false);
    });
    await t.test('revoked member and signed-out form calls cannot mutate',async()=>{
      await as(owner);await run(operation,{operation:'revoke',id:employeeMembership},true);
      await as(employee);await run(operation,{operation:'leave',employee:e,title:'No access',start:'2020-01-07',end:'2020-01-07',leave_type:'Custom'},false);
      await as(null);const f=new FormData();f.set('operation','invite');f.set('owner',owner);
      await assert.rejects(operation(f),(e:unknown)=>e instanceof Navigation&&e.location==='/en/sign-in');
      await assert.rejects(leave(f),(e:unknown)=>e instanceof Navigation&&e.location==='/en/sign-in');
      await assert.rejects(evidence(f),(e:unknown)=>e instanceof Navigation&&e.location==='/en/sign-in');
      await assert.rejects(importPayroll(f),(e:unknown)=>e instanceof Navigation&&e.location==='/en/sign-in');
      await assert.rejects(voidPayroll(f),(e:unknown)=>e instanceof Navigation&&e.location==='/en/sign-in');
      assert.ok(invalidated.includes('/en/dashboard/workforce/operations'));assert.ok(invalidated.includes('/en/dashboard/workforce/leave'));
    });
  } finally {await db.close();}
});
