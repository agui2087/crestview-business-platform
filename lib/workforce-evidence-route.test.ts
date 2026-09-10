import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';

test('evidence download authorizes before storage, verifies bytes and fails closed on revocation or audit failure',async()=>{
  const source=await readFile(new URL('../app/api/workforce/evidence/[id]/route.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=createRequire(import.meta.url),body='synthetic certificate',digest=createHash('sha256').update(body).digest('hex');
  let signedIn=true,allowed=true,audit=true,storageReads=0,adminReads=0,tampered=false,auditError=false;
  const db={auth:{getUser:async()=>({data:{user:signedIn?{id:'synthetic-user'}:null}})},rpc:async(name:string)=>({data:name==='workforce_training_evidence_available'?allowed:audit,error:name==='workforce_record_evidence_download'&&auditError?{message:'audit failed'}:null})};
  const mock=(name:string)=>{
    if(name==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>db};
    if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>{adminReads++;const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{storage_key:'private/object',scan_sha256:digest,original_name:'certificate.txt',content_type:'text/plain',size_bytes:body.length},error:null})};return {from:()=>chain};}};
    if(name==='@/lib/document-vault')return {maxDocumentBytes:10485760,getDocumentStorage:()=>({download:async()=>{storageReads++;return {data:new Blob([tampered?'x'.repeat(body.length):body]),error:null};}})};
    if(name==='@/lib/observability')return {createRequestId:()=> 'request',reportOperationalEvent:async()=>{}};
    return require(name);
  };
  const exports:{GET?:(r:Request,c:{params:Promise<{id:string}>})=>Promise<Response>}={};
  runInNewContext(code,{exports,require:mock,Response,Buffer});
  const get=()=>exports.GET!(new Request('https://example.test/api/workforce/evidence/id'),{params:Promise.resolve({id:'00000000-0000-4000-8000-000000000001'})});
  signedIn=false;assert.equal((await get()).status,401);assert.equal(adminReads,0);
  signedIn=true;allowed=false;assert.equal((await get()).status,404);assert.equal(storageReads,0);assert.equal(adminReads,0);
  allowed=true;tampered=true;assert.equal((await get()).status,404);
  tampered=false;audit=false;assert.equal((await get()).status,404);
  audit=true;auditError=true;assert.equal((await get()).status,404);
  auditError=false;const result=await get();assert.equal(result.status,200);assert.equal(await result.text(),body);
  assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.match(result.headers.get('content-disposition')??'',/^attachment;/);
});
