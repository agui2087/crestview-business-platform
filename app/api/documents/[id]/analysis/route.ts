import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {privateAnalysisEnabled} from '@/lib/private-analysis';

export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
type Context={params:Promise<{id:string}>};
async function handle(request:NextRequest,context:Context,enqueue:boolean){
  if(!privateAnalysisEnabled()) return reply({error:'Analysis is not available yet.'},503);
  const {id}=await context.params;
  if(!z.uuid().safeParse(id).success) return reply({error:'Invalid document.'},400);
  if(enqueue && request.headers.get('origin')!==request.nextUrl.origin) return reply({error:'Invalid origin.'},403);
  const client=await createSupabaseServerClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user) return reply({error:'Sign in required.'},401);
  if(enqueue){
    const parsed=z.object({locale:z.enum(['en','es']),consent:z.literal(true)}).strict().safeParse(await request.json().catch(()=>null));
    if(!parsed.success) return reply({error:'Confirm private processing before continuing.'},400);
    const {data,error}=await client.rpc('queue_private_document_analysis',{p_document_id:id,p_locale:parsed.data.locale});
    if(error) return reply({error:'Unable to queue. Check your Pro access, PDF security status, and analysis allowance.'},409);
    return reply({id:data,status:'queued'},202);
  }
  const {data,error}=await client.rpc('read_private_document_analysis',{p_document_id:id});
  if(error) return reply({error:'Unable to read analysis status.'},503);
  return reply({job:data?.[0]??null});
}
export const GET=(request:NextRequest,context:Context)=>handle(request,context,false);
export const POST=(request:NextRequest,context:Context)=>handle(request,context,true);
