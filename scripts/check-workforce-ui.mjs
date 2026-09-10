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
  workforce_members:[{id:'member',owner_id:owner,user_id:worker,role:'employee',employee_id:employee,accepted_at:'2026-01-01',revoked_at:null}],
  employees:[{id:employee,user_id:owner,full_name:'Example Employee',email:'example@example.com',phone:null,position:'Operator',department:'Operations',manager_name:null,manager_user_id:null,start_date:'2026-01-01',employment_status:'active',preferred_locale:'en',version:1,archived_at:null}],
  workforce_requests:[{id:'request',employee_id:employee,kind:'leave',title:'Planned vacation',starts_on:'2026-10-01',ends_on:'2026-10-02',leave_type:'Vacation',status:'pending',created_by:worker,approver_id:owner,decision_reason:null,changes:{}}],
  workforce_tasks:[{id:'task',employee_id:employee,category:'training',title:'Safety induction',assignee_id:worker,due_on:'2026-01-01',status:'open',evidence:null,completed_by:null,verified_at:null,requirement_id:'requirement'}],
  workforce_history:[],
  employee_records:[{id:'record',employee_id:employee,title:'Safety certificate',expires_on:'2026-01-01',record_type:'certification'}],
  workforce_requirements:[{id:'requirement',position:'Operator',title:'Safety induction',renewal_days:365}],
};
const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async()=>({data:'owner',error:null}),from(table){
  const result={data:fixture[table]??[],error:null};
  const chain=new Proxy({}, {get:(_,key)=>key==='then'?Promise.resolve(result).then.bind(Promise.resolve(result)):()=>chain});return chain;
}};
const source=await readFile(new URL('../app/[locale]/dashboard/workforce/operations/page.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
const mockRequire=(name)=>{
  if(name.endsWith('.css'))return {};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='next/navigation')return {notFound(){throw Error('not found')},redirect(){throw Error('redirect')}};
  if(name==='@/lib/i18n')return {isLocale:x=>['en','es'].includes(x)};
  if(name==='@/lib/supabase/server')return {isSupabaseConfigured:()=>true,createSupabaseServerClient:async()=>db};
  if(name==='./actions')return {workforceOperation:async()=>{}};
  if(name==='@/components/platform-shell')return {PlatformShell:({children})=>React.createElement('main',{id:'main-content'},children),PageHeading:({title,body,action})=>React.createElement('header',null,React.createElement('h1',null,title),React.createElement('p',null,body),action)};
  return require(name);
};
runInNewContext(compiled,{exports,require:mockRequire,Date,Promise,console});
const css=(await readFile(new URL('../app/globals.css',import.meta.url),'utf8'))+'\n'+await readFile(new URL('../app/[locale]/dashboard/workforce/operations/workforce-operations.css',import.meta.url),'utf8');
const out=path.join(tmpdir(),'crestview-workforce-ui');await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try {
  for(const locale of ['en','es'])for(const width of [1440,390]) {
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage();
    const view=await exports.default({params:Promise.resolve({locale}),searchParams:Promise.resolve({})});
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
