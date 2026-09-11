import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

async function harness({ signedIn=true, inquiry=true, document=true, mime="application/pdf", signing=true }={}) {
  const source=await readFile(new URL("../app/[locale]/dashboard/deals/[id]/documents/[documentId]/page.tsx",import.meta.url),"utf8");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const filters:unknown[]=[]; const signatures:unknown[]=[];
  const client={auth:{getUser:async()=>({data:{user:signedIn?{id:"buyer"}:null},error:null})},from:(table:string)=>{
    const q={select:()=>q,eq:(key:string,value:unknown)=>{filters.push([table,key,value]);return q;},or:(value:string)=>{filters.push([table,"or",value]);return q;},in:(key:string,value:unknown)=>{filters.push([table,key,value]);return q;},maybeSingle:async()=>({data:table==="deal_inquiries"?(inquiry?{id:"deal"}:null):(document?{title:"Test",storage_path:"scanned.pdf",mime_type:mime}:null),error:null})};return q;
  },storage:{from:()=>({createSignedUrl:async(...args:unknown[])=>{signatures.push(args);return{data:signing?{signedUrl:"https://storage.invalid/signed"}:null};}})}};
  const exports:{default?:(p:unknown)=>Promise<unknown>}={};
  runInNewContext(code,{exports,Promise,require:(name:string)=>{
    if(name==="react/jsx-runtime")return {jsx:(type:unknown,props:unknown)=>({type,props}),jsxs:(type:unknown,props:unknown)=>({type,props})};
    if(name==="next/navigation")return{notFound:()=>{throw new Error("NOT_FOUND");}};
    if(name==="@/lib/i18n")return{isLocale:(v:string)=>["en","es"].includes(v)};
    if(name==="@/lib/supabase/server")return{isSupabaseConfigured:()=>true,createSupabaseServerClient:async()=>client};
    if(name==="@/components/secure-pdf-viewer")return{SecurePdfViewer:"Viewer"};
    throw new Error(name);
  }});
  return{run:()=>exports.default!({params:Promise.resolve({locale:"en",id:"deal",documentId:"doc"})}),filters,signatures};
}
test("PDF access denies unauthenticated, unrelated, unavailable and non-PDF records before signing",async()=>{
  for(const options of [{signedIn:false},{inquiry:false},{document:false},{mime:"text/html"}]){
    const h=await harness(options);await assert.rejects(h.run(),/NOT_FOUND/);assert.equal(h.signatures.length,0);
  }
});
test("PDF access scopes active screened evidence to current deal and signs view/download separately",async()=>{
  const h=await harness();await h.run();
  const filters=JSON.stringify(h.filters);
  for(const required of ['"inquiry_id","deal"','"id","doc"','"is_active",true','"security_status",["basic_validated","malware_scanned"]','buyer_id.eq.buyer,broker_id.eq.buyer'])assert.ok(filters.includes(required));
  assert.equal(JSON.stringify(h.signatures),JSON.stringify([["scanned.pdf",900],["scanned.pdf",900,{download:true}]]));
});
test("PDF signing failure renders an error instead of an empty viewer",async()=>{
  const h=await harness({signing:false});const output=JSON.stringify(await h.run());assert.ok(output.includes("could not be opened"));assert.ok(!output.includes('"type":"Viewer"'));
});
