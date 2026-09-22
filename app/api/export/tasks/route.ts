import {createSupabaseServerClient,isSupabaseConfigured} from '@/lib/supabase/server';
import {tasksCsv,type TaskExport} from '@/lib/customer-export';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 if(!isSupabaseConfigured())return Response.json({error:'Export unavailable.'},{status:503,headers});
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return Response.json({error:'Sign in to export your tasks.'},{status:401,headers});
 try {
  const rows:TaskExport[]=[];
  for(let offset=0;;offset+=500){
   const {data,error}=await db.from('deal_tasks').select('title,opportunity_key,due_date,priority,status').eq('user_id',user.id).order('id').range(offset,offset+499);
   if(error)throw error;
   rows.push(...(data??[]));
   if(!data||data.length<500)break;
   if(rows.length>=10000)return Response.json({error:'Export is too large. No partial export was generated.'},{status:413,headers});
  }
  return new Response(tasksCsv(rows,new URL(request.url).searchParams.get('locale')==='es'),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="crestview-tasks.csv"'}});
 }catch{return Response.json({error:'Tasks could not be loaded. No partial export was generated.'},{status:503,headers});}
}
