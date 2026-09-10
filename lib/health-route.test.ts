import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
test('health probe avoids full-table counts and reports database failure without caching',async()=>{
  const code=ts.transpileModule(await readFile(new URL('../app/api/health/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let failed=false,limited=false,reported=0;
  const chain={select:(_name:string,options:Record<string,unknown>)=>{assert.equal(options.head,true);assert.equal(options.count,undefined);return chain;},limit:(n:number)=>{assert.equal(n,1);limited=true;return chain;},abortSignal:async()=>({error:failed?new Error('Synthetic unavailable'):null})};
  const exports:{GET?:()=>Promise<Response>}={};
  runInNewContext(code,{exports,process:{env:{}},Date,AbortSignal,require:(name:string)=>{
    if(name==='next/server')return {NextResponse:Response};
    if(name==='@/lib/observability')return {reportOperationalEvent:async()=>{reported++;}};
    if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>({from:()=>chain})};
    throw new Error(name);
  }});
  let result=await exports.GET!();assert.equal(result.status,200);assert.equal(limited,true);
  assert.equal(result.headers.get('cache-control'),'no-store, max-age=0');
  failed=true;result=await exports.GET!();assert.equal(result.status,503);assert.equal(reported,1);
});
