import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import type Stripe from 'stripe';
type Module=typeof import('./listing-product-server');
const user='00000000-0000-4000-8000-000000000001',listing='00000000-0000-4000-8000-000000000011',orderId='00000000-0000-4000-8000-000000000021';
test('listing checkout server validates actual payment and preserves retry identity',async t=>{
  const calls:{name:string;params:Record<string,unknown>}[]=[];
  const order={id:orderId,listing_id:listing,user_id:user,product_code:'single_listing',price_id:'price_fixture',customer_id:'cus_fixture',status:'pending',checkout_session_id:null as string|null,checkout_expires_at:'2030-01-01T00:35:00Z',created_at:'2030-01-01T00:00:00Z'};
  const metadata={fulfillment_version:'listing-v1',listing_order_id:orderId,listing_id:listing,crestview_user_id:user,product_code:'single_listing'};
  let paid=true,badPrice=false,quantity=1,rpcFailure=false,refunded=false;
  let recoverFound=true,more=false,paymentStatus='requires_payment_method',paymentError=true;
  const session=()=>({id:'cs_fixture',mode:'payment',status:'open',url:'https://checkout.stripe.com/synthetic',payment_status:paid?'paid':'unpaid',metadata,client_reference_id:user,customer:'cus_fixture',payment_intent:'pi_fixture'});
  const exports={} as Module;
  const stripe={prices:{retrieve:async()=>({active:true,currency:'usd',unit_amount:badPrice?1:3000,recurring:null})},
    checkout:{sessions:{list:async()=>({data:recoverFound?[session()]:[],has_more:more}),retrieve:async()=>session(),listLineItems:async()=>({has_more:false,data:[{price:{id:'price_fixture'},quantity}]}),create:async(params:Record<string,unknown>,options:Record<string,unknown>)=>{calls.push({name:'stripe.create',params:{...params,...options}});return session();}}},
    charges:{retrieve:async()=>({payment_intent:'pi_fixture',amount:3000,amount_refunded:refunded?3000:100,refunded})},
    paymentIntents:{retrieve:async()=>({metadata,customer:'cus_fixture',status:paymentStatus,last_payment_error:paymentError?{code:'failed'}:null})},
  };
  runInNewContext(ts.transpileModule(await readFile(new URL('./listing-product-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,URL,require:(name:string)=>{
      if(name==='server-only')return {};
      if(name==='@/lib/stripe/server')return {getStripe:()=>stripe};
      if(name==='@/lib/stripe/config')return {getProductCodeForPrice:()=> 'single_listing',STRIPE_INTEGRATION_IDENTIFIER:'synthetic_abcdefgh'};
      if(name==='@/lib/billing-availability')return {isListingProduct:(p:string)=>p==='single_listing'};
      if(name==='@/lib/supabase/admin')return {createSupabaseAdminClient:()=>({rpc:async(name:string,params:Record<string,unknown>)=>{calls.push({name,params});return {data:name==='prepare_listing_product_order'?[order]:true,error:rpcFailure?new Error('Synthetic database failure'):null};}})};
      throw new Error(name);
    }
  });
  const event={id:'evt_fixture'} as Stripe.Event;
  const input={userId:user,listingId:listing,product:'single_listing',price:'price_fixture',customer:'cus_fixture',locale:'en',origin:'https://crestview.example'};
  await t.test('retry uses the order ID and fixed expiry, with exact listing metadata',async()=>{
    await exports.listingProductCheckout(input);const created=calls.find(c=>c.name==='stripe.create')!;
    assert.equal(created.params.idempotencyKey,`crestview-listing-order-${orderId}`);
    assert.equal((created.params.metadata as Record<string,string>).listing_id,listing);
    assert.equal('payment_method_types' in created.params,false);
    assert.equal(calls.at(-1)?.name,'bind_listing_product_checkout');
    calls.length=0;order.checkout_session_id='cs_fixture';await exports.listingProductCheckout(input);
    assert.equal(calls.some(c=>c.name==='stripe.create'),false);order.checkout_session_id=null;
  });
  await t.test('wrong configured price refuses checkout before reservation',async()=>{
    calls.length=0;badPrice=true;await assert.rejects(exports.listingProductCheckout(input));assert.equal(calls.length,0);badPrice=false;
  });
  await t.test('lost binding recovers the existing checkout without creating a second session',async()=>{
    calls.length=0;order.checkout_expires_at=new Date(Date.now()+30*60_000).toISOString();order.created_at=new Date(Date.now()-5*60_000).toISOString();
    await exports.listingProductCheckout(input);assert.equal(calls.some(c=>c.name==='stripe.create'),false);
    assert.equal(calls.some(c=>c.name==='bind_listing_product_checkout'),true);
    recoverFound=false;calls.length=0;await assert.rejects(exports.listingProductCheckout(input));assert.equal(calls.some(c=>c.name==='expire_unbound_listing_order'),false);
    more=true;await assert.rejects(exports.listingProductCheckout(input));more=false;recoverFound=true;order.checkout_expires_at='2030-01-01T00:35:00Z';
  });
  await t.test('delayed payment failure releases only an authoritatively failed payment',async()=>{
    calls.length=0;paid=false;paymentStatus='processing';await exports.failListingCheckout(session() as unknown as Stripe.Checkout.Session);assert.equal(calls.length,0);
    paymentStatus='requires_payment_method';paymentError=false;await exports.failListingCheckout(session() as unknown as Stripe.Checkout.Session);assert.equal(calls.length,0);
    paymentError=true;await exports.failListingCheckout(session() as unknown as Stripe.Checkout.Session);assert.equal(calls[0].name,'fail_listing_product_checkout');
    calls.length=0;paid=true;await exports.failListingCheckout(session() as unknown as Stripe.Checkout.Session);assert.equal(calls.length,0);
  });
  await t.test('unpaid sessions cannot fulfill; paid sessions use server verified identity',async()=>{
    calls.length=0;paid=false;await exports.deliverListingCheckout(event,session() as unknown as Stripe.Checkout.Session);assert.equal(calls.length,0);
    paid=true;await exports.deliverListingCheckout(event,session() as unknown as Stripe.Checkout.Session);assert.equal(calls[0].name,'deliver_listing_product');assert.equal(calls[0].params.p_listing_id,listing);
    calls.length=0;quantity=2;await assert.rejects(exports.deliverListingCheckout(event,session() as unknown as Stripe.Checkout.Session));assert.equal(calls.length,0);quantity=1;
  });
  await t.test('delivery failure propagates for webhook retry instead of acknowledging success',async()=>{
    rpcFailure=true;await assert.rejects(exports.deliverListingCheckout(event,session() as unknown as Stripe.Checkout.Session));rpcFailure=false;
  });
  await t.test('only full refunds or disputes revoke; partial refunds do not silently cancel access',async()=>{
    calls.length=0;await exports.revokeListingCharge(event,'ch_fixture','refunded');assert.equal(calls.length,0);
    refunded=true;await exports.revokeListingCharge(event,'ch_fixture','refunded');assert.equal(calls[0].name,'revoke_listing_product_payment');
    calls.length=0;refunded=false;await exports.revokeListingCharge(event,'ch_fixture','disputed');assert.equal(calls[0].params.p_reason,'disputed');
  });
});
