import {createHash} from 'node:crypto';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getDocumentStorage,maxDocumentBytes} from '@/lib/document-vault';
import {createRequestId,reportOperationalEvent} from '@/lib/observability';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const unavailable=()=>Response.json({error:'Training evidence is unavailable.'},{status:404,headers});

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const requestId=createRequestId();
  try {
    const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();
    if(!user)return Response.json({error:'Sign in to view training evidence.'},{status:401,headers});
    const {id}=await params;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return unavailable();
    const permitted=await db.rpc('workforce_training_evidence_available',{p_evidence:id});
    if(permitted.error||permitted.data!==true)return unavailable();
    // Admin storage is reached only after session-scoped authorization.
    const row=await createSupabaseAdminClient().from('workforce_training_evidence').select('storage_key,scan_sha256,original_name,content_type,size_bytes').eq('id',id).maybeSingle();
    if(row.error||!row.data||Number(row.data.size_bytes)>maxDocumentBytes)return unavailable();
    const file=await getDocumentStorage().download(row.data.storage_key);
    if(file.error||!file.data||file.data.size>maxDocumentBytes||file.data.size!==Number(row.data.size_bytes))return unavailable();
    const bytes=await file.data.arrayBuffer();
    if(createHash('sha256').update(Buffer.from(bytes)).digest('hex')!==row.data.scan_sha256)return unavailable();
    // Recheck access after retrieval. Audit failure releases no file bytes.
    const audit=await db.rpc('workforce_record_evidence_download',{p_evidence:id});
    if(audit.error||audit.data!==true)return unavailable();
    return new Response(bytes,{headers:{...headers,'Content-Type':row.data.content_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.data.original_name)}`}});
  }catch(error){
    await reportOperationalEvent({event:'workforce.evidence_download_failed',level:'error',requestId,route:'/api/workforce/evidence/[id]',error});
    return Response.json({error:'Training evidence is temporarily unavailable.'},{status:503,headers});
  }
}
