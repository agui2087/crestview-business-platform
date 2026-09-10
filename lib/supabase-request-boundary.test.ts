import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('Supabase establishes request-time rendering before requiring deployment configuration',async()=>{
  const source=await readFile(new URL('./supabase/server.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const boundary=new Error('Synthetic Next request-time boundary');
  let rendering=true,constructed=0;
  const exports:{createSupabaseServerClient?:()=>Promise<unknown>}={};
  runInNewContext(code,{exports,process:{env:{}},require:(name:string)=>{
    if(name==='server-only')return {};
    if(name==='next/headers')return {cookies:async()=>{if(rendering)throw boundary;return {getAll:()=>[],set:()=>{}};}};
    if(name==='@supabase/ssr')return {createServerClient:()=>{constructed++;return {};}};
    throw new Error(name);
  }});
  await assert.rejects(exports.createSupabaseServerClient!(),e=>e===boundary);
  rendering=false;
  await assert.rejects(exports.createSupabaseServerClient!(),/Supabase is not configured/);
  assert.equal(constructed,0); // Never invent a fallback key/client.
});
