import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {dealOpportunity,inquiryIdFromOpportunity} from "./deal-opportunity.ts";

test("real listing plans preserve missing figures rather than inventing data",()=>{
  const id="00000000-0000-4000-8000-000000000001";
  assert.equal(inquiryIdFromOpportunity(`deal-${id}`),id);
  assert.equal(inquiryIdFromOpportunity("deal-not-a-uuid"),null);
  const item=dealOpportunity({id,subject:"Synthetic deal",updated_at:"2026-09-10",status:"closed"},null,"en");
  assert.equal(item.priceValue,null);assert.equal(item.cashFlowValue,null);
  assert.equal(item.title,"Synthetic deal");assert.equal(item.sourceUrl,`/en/dashboard/deals/${id}`);
});

test("real checklist resolver requires authenticated buyer ownership and fails visibly on read errors",async()=>{
  const code=ts.transpileModule(await readFile(new URL('./opportunity-resolver.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let signedIn=false,reads=0,fail=false;
  const query={select:()=>query,eq:(column:string,value:string)=>{assert.equal(column,"buyer_id");assert.equal(value,"synthetic-buyer");return query;},in:async()=>{reads++;return {data:[],error:fail?new Error("Synthetic database failure"):null};}};
  const exports:{resolveOpportunities?:(keys:string[],locale:string)=>Promise<Map<string,unknown>>}={};
  runInNewContext(code,{exports,Map,Set,require:(name:string)=>{
    if(name==='server-only')return {};
    if(name==='@/lib/demo-data')return {getOpportunity:()=>null};
    if(name==='@/lib/deal-opportunity')return {dealOpportunity,inquiryIdFromOpportunity};
    if(name==='@/lib/supabase/server')return {isSupabaseConfigured:()=>true,createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:'synthetic-buyer'}:null}})},from:()=>query})};
    throw new Error(name);
  }});
  const key="deal-00000000-0000-4000-8000-000000000001";
  assert.equal((await exports.resolveOpportunities!([key],"en")).size,0);assert.equal(reads,0);
  signedIn=true;assert.equal((await exports.resolveOpportunities!([key],"en")).size,0);assert.equal(reads,1);
  fail=true;await assert.rejects(exports.resolveOpportunities!([key],"en"),/could not be loaded/);
});
