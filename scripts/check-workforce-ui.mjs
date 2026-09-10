// Isolated presentation test: real operations component + synthetic data.
// Database authorization and mutations are tested separately with PostgreSQL.
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const owner='00000000-0000-4000-8000-000000000001', worker='00000000-0000-4000-8000-000000000002', employee='00000000-0000-4000-8000-000000000003';
const fixture={
  workforce_payroll_imports:[{id:'batch',reference:'Reviewed source batch',created_at:'2026-09-01T12:00:00Z',voided_at:null}],
  workforce_payroll_history:[{id:1,action:'IMPORT',reason:'Reviewed analytical import',created_at:'2026-09-01T12:00:00Z'}],
  workforce_leave_policies:[{id:'policy',employee_id:employee,leave_type:'Custom leave',starts_on:'2026-01-01',ends_on:'2026-12-31',accrual_minutes:600,balance_cap_minutes:6000,version:1,review_reference:'Reviewed fixture'}],
  workforce_leave_ledger:[{id:'entry',effective_on:'2026-01-01',kind:'opening',minutes:480,reference:'migration',reason:'Reviewed opening'}],
  workforce_schedules:[{id:'schedule',employee_id:employee,starts_on:'2026-09-01',ends_on:null,timezone:'America/Los_Angeles',daily_minutes:[480,480,480,480,480,0,0],version:1,cancelled:false,reason:'Reviewed weekly plan'}],
  workforce_business_settings:{business_name:'Example business',timezone:'America/Los_Angeles',version:1},
  workforce_locations:[{id:'location',name:'Main office',country_code:'US',region:'California',timezone:'America/Los_Angeles',archived:false,version:1}],
  workforce_departments:[{id:'department',name:'Operations',archived:false,version:1}],
  workforce_members:[{id:'member',owner_id:owner,user_id:worker,role:'employee',employee_id:employee,accepted_at:'2026-01-01',revoked_at:null}],
  employees:[{id:employee,user_id:owner,full_name:'Example Employee',email:'example@example.com',phone:null,position:'Operator',department:'Operations',manager_name:null,manager_user_id:null,start_date:'2026-01-01',employment_status:'active',preferred_locale:'en',version:1,archived_at:null}],
  workforce_requests:[{id:'request',employee_id:employee,kind:'leave',title:'Planned vacation',starts_on:'2026-10-01',ends_on:'2026-10-02',leave_type:'Vacation',status:'pending',created_by:worker,approver_id:owner,decision_reason:null,changes:{}}],
  workforce_tasks:[{id:'task',employee_id:employee,category:'training',title:'Safety induction',assignee_id:worker,due_on:'2026-01-01',status:'open',evidence:null,completed_by:null,verified_at:null,requirement_id:'requirement',version:1,change_reason:null}],
  workforce_templates:[{id:'template',title:'Custom onboarding',category:'onboarding',items:['Meet your manager','Review policies'],version:1,archived:false}],
  workforce_history:[],
  employee_records:[{id:'record',employee_id:employee,title:'Safety certificate',expires_on:'2026-01-01',record_type:'certification'}],
  workforce_requirements:[{id:'requirement',position:'Operator',title:'Safety induction',renewal_days:365}],
};
const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async(name)=>({data:name==='workforce_payroll_totals'?[{currency:'USD',period_start:'2026-08-01',period_end:'2026-08-31',employees:1,gross_minor:100001,employer_cost_minor:120001,paid_hours_hundredths:16000}]:name==='workforce_leave_balance'?[{configured:true,minutes:480,entry_count:1}]:'owner',error:null}),from(table){
  const result={data:fixture[table]??[],error:null};
  const chain=new Proxy({}, {get:(_,key)=>key==='then'?Promise.resolve(result).then.bind(Promise.resolve(result)):key==='maybeSingle'?()=>Promise.resolve({...result,data:Array.isArray(result.data)?result.data[0]:result.data}):()=>chain});return chain;
}};
const setup=process.env.CRESTVIEW_UI_SETUP==='true';
const schedules=process.env.CRESTVIEW_UI_SCHEDULES==='true';
const leave=process.env.CRESTVIEW_UI_LEAVE==='true';
const payroll=process.env.CRESTVIEW_UI_PAYROLL==='true';
const source=await readFile(new URL(`../app/[locale]/dashboard/workforce/${payroll?'payroll':leave?'leave':schedules?'schedules':setup?'setup':'operations'}/page.tsx`,import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
const checklistSource=await readFile(new URL('../app/[locale]/dashboard/workforce/operations/checklist-management.tsx',import.meta.url),'utf8');
const checklistCompiled=ts.transpileModule(checklistSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const checklistExports={};
const analyticsSource=await readFile(new URL('../app/[locale]/dashboard/workforce/operations/analytics.tsx',import.meta.url),'utf8');
const analyticsCompiled=ts.transpileModule(analyticsSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const analyticsExports={};
const payrollSource=await readFile(new URL('../app/[locale]/dashboard/workforce/payroll/import-form.tsx',import.meta.url),'utf8');
const payrollCompiled=ts.transpileModule(payrollSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const payrollExports={};
const mockRequire=(name)=>{
  if(name.endsWith('.css'))return {};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='next/navigation')return {notFound(){throw Error('not found')},redirect(){throw Error('redirect')}};
  if(name==='@/lib/i18n')return {isLocale:x=>['en','es'].includes(x)};
  if(name==='@/lib/workforce-calendar')return require('../lib/workforce-calendar.ts');
  if(name==='@/lib/workforce-analytics')return require('../lib/workforce-analytics.ts');
  if(name==='@/lib/workforce-actions')return require('../lib/workforce-actions.ts');
  if(name==='@/lib/workforce-payroll')return require('../lib/workforce-payroll.ts');
  if(name==='@/lib/supabase/server')return {isSupabaseConfigured:()=>true,createSupabaseServerClient:async()=>db};
  if(name==='./actions'||name==='../operations/actions')return {workforceOperation:async()=>{},saveSchedule:async()=>{},leaveOperation:async()=>{},importPayroll:async()=>({error:''}),voidPayroll:async()=>{}};
  if(name==='./import-form')return payrollExports;
  if(name==='./checklist-management')return checklistExports;
  if(name==='./analytics')return analyticsExports;
  if(name==='@/components/platform-shell')return {PlatformShell:({children})=>React.createElement('main',{id:'main-content'},children),PageHeading:({title,body,action})=>React.createElement('header',null,React.createElement('h1',null,title),React.createElement('p',null,body),action)};
  return require(name);
};
runInNewContext(checklistCompiled,{exports:checklistExports,require:mockRequire,Date,Promise,console});
runInNewContext(analyticsCompiled,{exports:analyticsExports,require:mockRequire,Date,Promise,console});
runInNewContext(payrollCompiled,{exports:payrollExports,require:mockRequire,Date,Promise,console});
runInNewContext(compiled,{exports,require:mockRequire,Date,Promise,console});
const css=(await readFile(new URL('../app/globals.css',import.meta.url),'utf8'))+'\n'+await readFile(new URL('../app/[locale]/dashboard/workforce/operations/workforce-operations.css',import.meta.url),'utf8');
const out=path.join(tmpdir(),payroll?'crestview-workforce-payroll-ui':leave?'crestview-workforce-leave-ui':schedules?'crestview-workforce-schedules-ui':setup?'crestview-workforce-setup-ui':'crestview-workforce-ui');await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try {
  for(const locale of ['en','es'])for(const width of [1440,390]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage();
    const view=await exports.default({params:Promise.resolve({locale}),searchParams:Promise.resolve(payroll?{batch:'batch'}:leave?{policy:'policy'}:{})});
    await page.setContent(`<!doctype html><html lang="${locale}"><head><title>Workforce UI test</title><style>${css}</style></head><body>${renderToStaticMarkup(view)}</body></html>`);
    await page.locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${locale} ${width}: horizontal overflow`);
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`${locale} ${width}: accessibility`);
    await page.screenshot({path:path.join(out,`${locale}-${width}.png`),fullPage:true});
    await context.close();console.log(`PASS ${locale} ${width}: expanded forms, no overflow, automated accessibility`);
  }
} finally {await browser.close();}
console.log(`Screenshots: ${out}`);
