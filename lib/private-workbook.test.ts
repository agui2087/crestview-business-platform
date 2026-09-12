import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('private workbook download checks authentication and current Pro before storage access',async()=>{
 const source=await readFile(new URL('../app/api/export/financial-due-diligence/route.ts',import.meta.url),'utf8');
 let configured=true,user:object|null={id:'synthetic'},entitlement:object|null=null,billingError:object|null=null,storageError=false,downloads=0;
 const result:Record<string,()=>Promise<Response>>={};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:result,Response,Blob,Date,require:(name:string)=>{
   if(name==='@/lib/private-workbook')return {workbookBucket:'paid-workbooks',workbookObject:'financial-due-diligence/2026-09-12.xlsx'};
   if(name==='@/lib/supabase/server'){
    const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:entitlement,error:billingError})};
    return {isSupabaseConfigured:()=>configured,createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user}})},from:()=>query})};
   }
   if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>({storage:{from:(bucket:string)=>{assert.equal(bucket,'paid-workbooks');return {download:async(path:string)=>{downloads++;assert.equal(path,'financial-due-diligence/2026-09-12.xlsx');return storageError?{data:null,error:{}}:{data:new Blob(['synthetic-test-only']),error:null};}};}}})};
   throw new Error(name);
  }
 });
 configured=false;assert.equal((await result.GET()).status,503);configured=true;
 user=null;assert.equal((await result.GET()).status,401);user={id:'synthetic'};
 for(const value of [null,{active:false},{active:true,expires_at:'2000-01-01'},{active:true,expires_at:'invalid'}]){entitlement=value;assert.equal((await result.GET()).status,403);}
 billingError={};assert.equal((await result.GET()).status,503);billingError=null;
 assert.equal(downloads,0,'no storage access before authorization');
 entitlement={active:true,expires_at:'2099-01-01'};const paid=await result.GET();
 assert.equal(paid.status,200);assert.equal(await paid.text(),'synthetic-test-only');assert.equal(paid.headers.get('cache-control'),'private, no-store');assert.equal(paid.headers.get('location'),null);
 storageError=true;assert.equal((await result.GET()).status,503);
 assert.doesNotMatch(source,/base64|createSignedUrl|getPublicUrl/);
});
