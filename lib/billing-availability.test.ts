import test from "node:test";
import assert from "node:assert/strict";
import { isCheckoutProductAvailable } from "./billing-availability.ts";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("undelivered paid listing products cannot open checkout, including a forged direct POST",async()=>{
  const source=await readFile(new URL('../app/api/stripe/checkout/route.ts',import.meta.url),'utf8');
  const exports:Record<string,(r:Request)=>Promise<{url:URL}>>={};
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,Request,FormData,String,URL,require:(name:string)=>{
      if(name==='node:crypto')return {};
      if(name==='next/server')return {NextResponse:{redirect:(url:URL)=>({url})}};
      if(name==='@/lib/billing-availability')return {isCheckoutProductAvailable};
      if(name==='@/lib/i18n')return {isLocale:()=>true};
      if(name==='@/lib/stripe/config')return {isProductCode:()=>true};
      if(name==='@/lib/stripe/request')return {hasValidOrigin:()=>true,stripeReturnUrl:(_:unknown,locale:string,query:Record<string,string>)=>new URL(`https://example.test/${locale}/pricing?${new URLSearchParams(query)}`)};
      if(name==='@/lib/observability')return {createRequestId:()=>"synthetic"};
      // Any auth/customer/Stripe call for these products is a test failure.
      return new Proxy({},{get(){throw new Error(`Unexpected dependency ${name}`);}});
    }
  });
  for(const product of ['single_listing','enhanced_visibility','highest_visibility']){
    assert.equal(isCheckoutProductAvailable(product),false);
    const data=new FormData();data.set('product_code',product);
    const result=await exports.POST(new Request('https://example.test/api/stripe/checkout',{method:'POST',body:data}));
    assert.equal(result.url.searchParams.get('billing_error'),'not_available');
  }
  for(const product of ['broker_plan','crestview_pro','workforce'])assert.equal(isCheckoutProductAvailable(product),true);
  assert.equal(isCheckoutProductAvailable('unknown_product'),false);
});
