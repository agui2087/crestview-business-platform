import {createSupabaseServerClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'};
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return new Response(null,{status:404,headers});
 const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)return new Response(null,{status:401,headers});
 const template=new URL(req.url).searchParams.get('kind')==='template';
 const query=template?db.from('listing_nda_templates').select('storage_path').eq('listing_id',id).eq('broker_id',user.id):db.from('deal_ndas').select('storage_path').eq('id',id).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`);
 const {data:row}=await query.maybeSingle();if(!row?.storage_path)return new Response(null,{status:404,headers});
 const {data:file,error}=await db.storage.from('deal-files').download(row.storage_path);
 if(error||!file)return new Response(null,{status:503,headers});
 return new Response(file,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="agreement.pdf"'}});
}
