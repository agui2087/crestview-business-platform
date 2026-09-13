import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ReactNode} from 'react';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=await readFile(new URL('../components/listing-purchases.tsx',import.meta.url),'utf8');
for(const locale of ['en','es'])for(const failed of ['orders','plan','metrics','current']){
  test(`${locale} ${failed} failure keeps billing unknown and offers no duplicate checkout`,async()=>{
    const logs:unknown[]=[];
    const response=(name:string)=>Promise.resolve({data:name==='plan'?null:[],error:name===failed?{message:'sensitive internal failure'}:null});
    const query=(name:string):unknown=>new Proxy({}, {get:(_,key)=>key==='then'?response(name).then.bind(response(name)):()=>query(name)});
    const exports:{ListingPurchases?:(props:unknown)=>Promise<ReactNode>}={};
    runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
      exports,require:(name:string)=>{
        if(name==='@/lib/billing-availability')return {listingProductsEnabled:()=>true};
        if(name==='@/lib/observability')return {logOperationalEvent:(event:unknown)=>logs.push(event)};
        if(name==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>({
          from:(table:string)=>query(table==='billing_entitlements'?'plan':'orders'),
          rpc:(name:string)=>response(name==='my_listing_promotion_metrics'?'metrics':'current'),
        })};
        return require(name);
      },
    });
    const html=renderToStaticMarkup(await exports.ListingPurchases!({locale,userId:'synthetic',listings:[{id:'fixture',title:'Fixture',status:'draft'}]}));
    assert.match(html,/role="alert"/);
    assert.ok(html.includes(`/${locale}/dashboard/listings#listing-purchases`));
    assert.ok(html.includes(`/${locale}/pricing`));
    assert.doesNotMatch(html,/<form|\/api\/stripe\/checkout|sensitive internal failure/);
    assert.equal(logs.length,1);
    assert.doesNotMatch(JSON.stringify(logs),/sensitive internal failure|synthetic/);
  });
}
