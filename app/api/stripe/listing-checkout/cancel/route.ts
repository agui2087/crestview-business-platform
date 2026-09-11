import {NextResponse} from 'next/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getStripe} from '@/lib/stripe/server';
import {hasValidOrigin} from '@/lib/stripe/request';
import {reportOperationalEvent} from '@/lib/observability';
export async function POST(request:Request){
  if(!hasValidOrigin(request))return NextResponse.json({error:'Invalid origin'},{status:403});
  const form=await request.formData();const locale=form.get('locale')==='es'?'es':'en';
  const url=new URL(`/${locale}/dashboard/listings`,request.url);
  try{
    const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
    const {data:order,error}=await supabase.from('listing_product_orders').select('id,checkout_session_id,status').eq('id',String(form.get('order_id')??'')).eq('user_id',user.id).maybeSingle();
    if(error||!order||order.status!=='pending'||!order.checkout_session_id)throw new Error('Pending checkout cannot yet be canceled.');
    const stripe=getStripe();let session=await stripe.checkout.sessions.retrieve(order.checkout_session_id);
    if(session.status==='open')session=await stripe.checkout.sessions.expire(session.id);
    if(session.status!=='expired')throw new Error('Payment is already processing; review billing before trying again.');
    const result=await createSupabaseAdminClient().rpc('expire_listing_product_checkout',{p_order_id:order.id,p_session_id:session.id});
    if(result.error)throw result.error;
    url.searchParams.set('purchase','canceled');
  }catch(error){await reportOperationalEvent({event:'stripe.listing_checkout_cancel_failed',level:'error',route:'/api/stripe/listing-checkout/cancel',error});url.searchParams.set('purchase','review_required');}
  return NextResponse.redirect(url,303);
}
