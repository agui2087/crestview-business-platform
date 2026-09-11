import {NextResponse} from 'next/server';
import {hasValidOrigin} from '@/lib/stripe/request';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {listingProductsEnabled} from '@/lib/billing-availability';
export async function POST(request:Request){
  if(!listingProductsEnabled()||!hasValidOrigin(request))return new NextResponse(null,{status:403});
  if(Number(request.headers.get('content-length')??0)>1024)return new NextResponse(null,{status:413});
  try{
    const body=await request.text();if(body.length>1024)return new NextResponse(null,{status:413});
    const {listing_id,kind}=JSON.parse(body);
    if(typeof listing_id!=='string'||!['view','engagement'].includes(kind))return new NextResponse(null,{status:400});
    const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user)return new NextResponse(null,{status:204});
    const {error}=await supabase.rpc('record_listing_promotion_engagement',{p_listing_id:listing_id,p_kind:kind});
    return new NextResponse(null,{status:error?503:204});
  }catch{return new NextResponse(null,{status:400});}
}
