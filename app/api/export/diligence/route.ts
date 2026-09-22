import {createSupabaseServerClient,isSupabaseConfigured} from '@/lib/supabase/server';
import {diligenceCsv,type DiligenceExport} from '@/lib/customer-export';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 if(!isSupabaseConfigured())return Response.json({error:'Export unavailable.'},{status:503,headers});
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return Response.json({error:'Sign in to export your research.'},{status:401,headers});
 const params=new URL(request.url).searchParams,key=params.get('opportunity');
 if(!key||key.length>200||/[\x00-\x1f]/.test(key))return Response.json({error:'Choose an opportunity.'},{status:400,headers});
 try{
  const rows:DiligenceExport[]=[];
  for(let offset=0;;offset+=500){
   let query=db.from('diligence_items').select('category,title,status,due_date,assigned_role,notes').eq('user_id',user.id).eq('opportunity_key',key).order('id').range(offset,offset+499);
   if(params.get('unresolved')==='1')query=query.in('status',['open','requested','received','flagged']);
   const {data,error}=await query;if(error)throw error;
   rows.push(...(data??[]));if(!data||data.length<500)break;
   if(rows.length>=10000)return Response.json({error:'Export is too large. No partial export was generated.'},{status:413,headers});
  }
  return new Response(diligenceCsv(rows,params.get('locale')==='es'),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="crestview-private-diligence.csv"'}});
 }catch{return Response.json({error:'Research could not be loaded. No partial export was generated.'},{status:503,headers});}
}
