import 'server-only';
import type Stripe from 'stripe';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getStripe} from '@/lib/stripe/server';
import {getProductCodeForPrice,STRIPE_INTEGRATION_IDENTIFIER} from '@/lib/stripe/config';
import {isListingProduct} from '@/lib/billing-availability';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ListingOrder={id:string;listing_id:string;user_id:string;product_code:string;price_id:string;customer_id:string;status:string;checkout_session_id:string|null;checkout_expires_at:string};
const id=(v:string|{id:string}|null)=>typeof v==='string'?v:v?.id;
async function rpc(name:string,values:Record<string,unknown>){
  const {data,error}=await createSupabaseAdminClient().rpc(name,values);
  if(error)throw error;
  return data;
}
function orderRecord(value:unknown):ListingOrder{
  const order=Array.isArray(value)?value[0]:value;
  if(!order||typeof order!=='object'||!uuid.test(order.id??'')||typeof order.checkout_expires_at!=='string')throw new Error('Order reservation was not confirmed.');
  return order as ListingOrder;
}

export async function listingProductCheckout(values:{userId:string;listingId:string;product:string;price:string;customer:string;locale:string;origin:string}){
  if(!uuid.test(values.listingId)||!isListingProduct(values.product))throw new Error('Choose an owned listing first.');
  const stripe=getStripe();
  const configuredPrice=await stripe.prices.retrieve(values.price);
  const expectedAmounts:Record<string,number>={single_listing:3000,enhanced_visibility:4999,highest_visibility:9999};
  if(!configuredPrice.active||configuredPrice.currency!=='usd'||configuredPrice.unit_amount!==expectedAmounts[values.product]||configuredPrice.recurring){
    throw new Error('Listing product price does not match the displayed offer.');
  }
  let order=orderRecord(await rpc('prepare_listing_product_order',{p_user_id:values.userId,p_listing_id:values.listingId,p_product_code:values.product,p_price_id:values.price,p_customer_id:values.customer}));
  const returnUrl=new URL(`/${values.locale}/dashboard/listings`,values.origin);
  if(order.checkout_session_id){
    const existing=await stripe.checkout.sessions.retrieve(order.checkout_session_id);
    if(existing.status==='open' && existing.url)return existing.url;
    if(existing.status==='complete'){returnUrl.searchParams.set('purchase','processing');return returnUrl.toString();}
    if(existing.status!=='expired')throw new Error('Existing checkout requires review.');
    await rpc('expire_listing_product_checkout',{p_order_id:order.id,p_session_id:existing.id});
    order=orderRecord(await rpc('prepare_listing_product_order',{p_user_id:values.userId,p_listing_id:values.listingId,p_product_code:values.product,p_price_id:values.price,p_customer_id:values.customer}));
  }
  const metadata={crestview_user_id:values.userId,product_code:values.product,listing_id:values.listingId,listing_order_id:order.id,fulfillment_version:'listing-v1',locale:values.locale};
  const successUrl=new URL(returnUrl);successUrl.searchParams.set('purchase','processing');
  const cancelUrl=new URL(returnUrl);cancelUrl.searchParams.set('purchase','canceled');
  const session=await stripe.checkout.sessions.create({mode:'payment',customer:values.customer,line_items:[{price:values.price,quantity:1}],
    client_reference_id:values.userId,metadata,payment_intent_data:{metadata},success_url:successUrl.toString(),cancel_url:cancelUrl.toString(),
    expires_at:Math.floor(new Date(order.checkout_expires_at).getTime()/1000),integration_identifier:STRIPE_INTEGRATION_IDENTIFIER,
  },{idempotencyKey:`crestview-listing-order-${order.id}`});
  await rpc('bind_listing_product_checkout',{p_order_id:order.id,p_session_id:session.id});
  if(!session.url)throw new Error('Checkout URL missing.');
  return session.url;
}

export async function deliverListingCheckout(event:Stripe.Event,session:Stripe.Checkout.Session){
  // Retrieve authoritative payment state; never fulfill a query-string return.
  session=await getStripe().checkout.sessions.retrieve(session.id);
  if(session.mode!=='payment'||session.payment_status!=='paid')return;
  const metadata=session.metadata??{};
  const lines=await getStripe().checkout.sessions.listLineItems(session.id,{limit:2});
  const price=lines.data[0]?.price?.id;const product=price?getProductCodeForPrice(price):undefined;
  if(metadata.fulfillment_version!=='listing-v1'||!uuid.test(metadata.listing_order_id??'')||!uuid.test(metadata.listing_id??'')
    ||!uuid.test(metadata.crestview_user_id??'')||session.client_reference_id!==metadata.crestview_user_id
    ||!product||!isListingProduct(product)||metadata.product_code!==product||lines.has_more||lines.data.length!==1||lines.data[0].quantity!==1
    ||!id(session.customer)||!id(session.payment_intent))throw new Error('Listing checkout identity validation failed.');
  await rpc('deliver_listing_product',{p_order_id:metadata.listing_order_id,p_session_id:session.id,p_payment_intent_id:id(session.payment_intent),p_event_id:event.id,
    p_user_id:metadata.crestview_user_id,p_listing_id:metadata.listing_id,p_customer_id:id(session.customer),p_product_code:product,p_price_id:price});
}

export async function expireListingCheckout(session:Stripe.Checkout.Session){
  if(session.metadata?.fulfillment_version!=='listing-v1')return;
  const current=await getStripe().checkout.sessions.retrieve(session.id);
  if(current.status!=='expired'||!uuid.test(current.metadata?.listing_order_id??''))return;
  await rpc('expire_listing_product_checkout',{p_order_id:current.metadata?.listing_order_id,p_session_id:current.id});
}

export async function revokeListingCharge(event:Stripe.Event,chargeId:string,reason:'refunded'|'disputed'){
  const charge=await getStripe().charges.retrieve(chargeId);
  if(reason==='refunded' && (!charge.refunded || charge.amount_refunded<charge.amount))return;
  const paymentId=id(charge.payment_intent);if(!paymentId)return;
  const payment=await getStripe().paymentIntents.retrieve(paymentId);
  if(payment.metadata.fulfillment_version!=='listing-v1')return;
  await rpc('revoke_listing_product_payment',{p_payment_intent_id:paymentId,p_event_id:event.id,p_reason:reason});
}
