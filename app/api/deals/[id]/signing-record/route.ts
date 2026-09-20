import {matchesRecordedPdf} from '@/lib/signing-integrity';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
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
 const {data:completed,error:completedError}=await supabase.from('deal_nda_pdf_records').select('*').eq('nda_id',nda.id).maybeSingle();
 if(completedError)return fail('Completed PDF evidence temporarily unavailable',503);
 if(new URL(request.url).searchParams.get('format')==='signed') {
  if(!completed)return fail('This agreement has no visually completed PDF. Its original and evidence remain available.',404);
  const {data:file,error}=await createSupabaseAdminClient().storage.from('signed-agreements').download(completed.storage_path);
  if(error||!file)return fail('Completed PDF temporarily unavailable',503);
  const bytes=Buffer.from(await file.arrayBuffer());if(!matchesRecordedPdf(bytes,completed.sha256))return fail('Completed PDF integrity check failed',409);
  return new Response(bytes,{headers:{...privateHeaders,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="crestview-signed-agreement-${nda.id}.pdf"`}});
 }
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
 const visual=completed?{sha256:completed.sha256,original_sha256:completed.original_sha256,layout:completed.layout,field_values:completed.field_values,completed_at:completed.completed_at}:null;
 const {data:participants,error:participantError}=await supabase.from('deal_nda_signatures').select('role,signer_id,legal_name,field_values,appearance,signed_at').eq('nda_id',nda.id).order('signed_at');if(participantError)return fail('Participant evidence unavailable',503);
 return Response.json({format:'crestview-signing-evidence-v2',exported_at:new Date().toISOString(),record,visual,participants,events:events??[],notice:'Crestview account-based electronic acceptance. Participant records contain the actual signature method for each party. Not independent identity verification or a certificate-authority digital seal. Historical events before workflow tracking may be absent. Preserve this record and the original agreement together.'},{headers:{...privateHeaders,'Content-Disposition':`attachment; filename="crestview-signing-evidence-${nda.id}.json"`}});
}
