import {matchesRecordedPdf} from '@/lib/signing-integrity';
import {createSupabaseServerClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const privateHeaders={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 const fail=(message:string,status:number)=>Response.json({error:message},{status,headers:privateHeaders});
 if(!/^[0-9a-f-]{36}$/i.test(id))return fail('Not found',404);
 const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return fail('Sign in to access this record',401);
 const {data:nda,error}=await supabase.from('deal_ndas').select('id,inquiry_id,buyer_id,broker_id,document_name,template_body,template_version,storage_path,sent_at,signed_at,signer_name,signature_record,document_fingerprint').eq('inquiry_id',id).eq('status','signed').or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
 if(error)return fail('Record temporarily unavailable',503);
 if(!nda)return fail('Not found',404);
 if(new URL(request.url).searchParams.get('format')==='original') {
  if(!nda.storage_path)return fail('This agreement contains text, not an uploaded PDF. Download the evidence record instead.',404);
  const expected=nda.signature_record?.file_sha256;
  if(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))return fail('No recorded PDF fingerprint exists for this historical agreement. Its original cannot be integrity-verified here.',409);
  const {data:file,error:downloadError}=await supabase.storage.from('deal-files').download(nda.storage_path);
  if(downloadError||!file)return fail('Original agreement unavailable',503);
  const bytes=Buffer.from(await file.arrayBuffer());
  if(!matchesRecordedPdf(bytes,expected))return fail('Integrity check failed. This file does not match the signed record. Contact the broker; do not rely on this copy.',409);
  return new Response(bytes,{headers:{...privateHeaders,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="crestview-agreement-${nda.id}.pdf"`}});
 }
 const {data:events,error:eventsError}=await supabase.from('deal_nda_events').select('actor_id,event_type,occurred_at,details').eq('nda_id',nda.id).order('occurred_at');
 if(eventsError)return fail('Evidence history temporarily unavailable',503);
 const {storage_path:storagePath,...record}=nda;
 void storagePath;
 return Response.json({format:'crestview-signing-evidence-v1',exported_at:new Date().toISOString(),record,events:events??[],notice:'Crestview account-based electronic acceptance. Not independent identity verification or a certificate-authority digital seal. Historical events before workflow tracking may be absent. Preserve this record and the original agreement together.'},{headers:{...privateHeaders,'Content-Disposition':`attachment; filename="crestview-signing-evidence-${nda.id}.json"`}});
}
