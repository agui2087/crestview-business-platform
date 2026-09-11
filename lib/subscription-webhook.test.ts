import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('subscription webhook reads current Stripe state, verifies identity metadata and uses the ordered database routine',async()=>{
  const source=await readFile(new URL('../app/api/stripe/webhook/route.ts',import.meta.url),'utf8');
  const calls:Array<{name:string;params:Record<string,unknown>}>=[];
  let invalidSignature=false,invalidMetadata=false,retrievalFails=false;
  const current={id:'sub_fixture',customer:'cus_fixture',status:'canceled',cancel_at_period_end:false,
    metadata:{crestview_user_id:'00000000-0000-4000-8000-000000000001',product_code:'broker_plan'},
    items:{has_more:false,data:[{price:{id:'price_fixture'},quantity:1,current_period_end:2000000000}]}};
  const exports:Record<string,(r:Request)=>Promise<{status:number}>>={};
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,process:{env:{STRIPE_WEBHOOK_SECRET:'synthetic-test-only'}},require:(name:string)=>{
      if(name==='next/server')return {NextResponse:{json:(_:unknown,opts?:{status:number})=>({status:opts?.status??200})}};
      if(name==='@/lib/listing-product-server')return {};
      if(name==='@/lib/observability')return {createRequestId:()=>"synthetic",logOperationalEvent:()=>{},reportOperationalEvent:async()=>{}};
      if(name==='@/lib/stripe/config')return {getProductCodeForPrice:()=> 'broker_plan',productDefinitions:{broker_plan:{mode:'subscription'}}};
      if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>({rpc:async(name:string,params:Record<string,unknown>)=>{calls.push({name,params});return {error:null};}})};
      if(name==='@/lib/stripe/server')return {getStripe:()=>({
        webhooks:{constructEvent:()=>{if(invalidSignature)throw new Error('Invalid signature');return {id:'evt_fixture',created:100,type:'customer.subscription.updated',data:{object:{id:'sub_fixture',status:'active'}}};}},
        subscriptions:{retrieve:async(id:string)=>{assert.equal(id,'sub_fixture');if(retrievalFails)throw new Error('Synthetic Stripe outage');return {...current,metadata:invalidMetadata?{}:current.metadata};}}
      })};throw new Error(name);
    }
  });
  const request=()=>new Request('https://example.test/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'synthetic'},body:'synthetic'});
  assert.equal((await exports.POST(request())).status,200);
  assert.equal(calls[0].name,'apply_stripe_subscription_event');assert.equal(calls[0].params.p_status,'canceled');assert.equal(calls[0].params.p_event_created,100);
  calls.length=0;invalidMetadata=true;assert.equal((await exports.POST(request())).status,500);assert.equal(calls.length,0);
  invalidMetadata=false;retrievalFails=true;assert.equal((await exports.POST(request())).status,500);assert.equal(calls.length,0);
  retrievalFails=false;invalidSignature=true;assert.equal((await exports.POST(request())).status,400);assert.equal(calls.length,0);
});
