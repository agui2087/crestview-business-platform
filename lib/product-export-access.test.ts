import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

async function harness(options:{signedIn?:boolean;pro?:boolean;saved?:boolean;failure?:boolean}={}) {
  const filters:unknown[]=[];
  const db={auth:{getUser:async()=>({data:{user:options.signedIn===false?null:{id:'buyer'}}})},from:(table:string)=>{
    const data=table==='billing_entitlements'?{active:options.pro!==false,expires_at:null}:table==='saved_opportunities'?(options.saved===false?null:{stage:'diligence',notes:'Actual private note',next_action:'Review'}):[];
    const q={select:()=>q,eq:(key:string,value:unknown)=>{filters.push([table,key,value]);return q;},order:()=>q,limit:()=>Promise.resolve({data,error:options.failure?'failed':null}),maybeSingle:()=>Promise.resolve({data,error:options.failure?'failed':null})};return q;
  }};
  const source=await readFile(new URL('../app/api/export/decision-report/route.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:{GET?:(r:Request)=>Promise<Response>}={};
  runInNewContext(code,{exports,Response,URL,Date,Promise,require:(name:string)=>{
    if(name==='@/lib/supabase/server')return{createSupabaseServerClient:async()=>db,isSupabaseConfigured:()=>true};
    if(name==='@/lib/opportunity-resolver')return{resolveOpportunity:async()=>({title:'Actual deal',price:'100',revenue:'80',cashFlow:'20'})};
    throw new Error(name);
  }});
  return{run:()=>exports.GET!(new Request('https://example.invalid/api/export/decision-report?key=deal-test&locale=es')),filters};
}
test('decision reports reject anonymous, unpaid, missing and failed data',async()=>{
  for(const [options,status] of [[{signedIn:false},401],[{pro:false},403],[{saved:false},404],[{failure:true},503]] as const){const h=await harness(options);assert.equal((await h.run()).status,status);}
});
test('decision report is private, scoped to current owner/deal and uses actual notes',async()=>{
  const h=await harness(),response=await h.run();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const text=await response.text();assert.ok(text.includes('Actual private note'));assert.ok(text.includes('INFORME DE DECISIÓN'));
  for(const table of ['saved_opportunities','diligence_items','deal_document_findings']){assert.ok(JSON.stringify(h.filters).includes(JSON.stringify([table,'user_id','buyer'])));assert.ok(JSON.stringify(h.filters).includes(JSON.stringify([table,'opportunity_key','deal-test'])));}
});
