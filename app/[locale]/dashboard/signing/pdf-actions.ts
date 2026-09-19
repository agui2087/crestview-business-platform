'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {ndaFieldsSchema,parseNdaLayout,valuesForFields} from '@/lib/nda-fields';
import {inspectSigningPdf,completeSigningPdf,pdfHash} from '@/lib/nda-pdf';
import {signingState} from '@/lib/signing-workflow';
export async function savePdfFields(data:FormData):Promise<{error?:string;url?:string}> {
 const locale=data.get('locale')==='es'?'es':'en';
 try {
  const id=z.string().uuid().parse(data.get('listing_id')),version=z.coerce.number().int().positive().parse(data.get('version'));
  const raw=String(data.get('fields')??'');if(raw.length>30000)throw Error('Too many fields');
  const fields=ndaFieldsSchema.parse(JSON.parse(raw));
  const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)throw Error('Sign in again');
  const {data:t}=await db.from('listing_nda_templates').select('*').eq('listing_id',id).eq('broker_id',user.id).single();
  if(!t?.storage_path||t.version!==version||!['basic_validated','malware_scanned'].includes(t.security_status))throw Error('Template changed or unavailable. Reload before preparing it.');
  const {data:file,error}=await db.storage.from('deal-files').download(t.storage_path);if(error||!file)throw Error('Original PDF unavailable');
  const {pages,sha256}=await inspectSigningPdf(new Uint8Array(await file.arrayBuffer()));
  if(data.get('sha256')!==sha256)throw Error('The PDF changed. Reload before saving.');
  const layout=parseNdaLayout({fields,pages,sha256,revision:randomUUID()});
  const {error:saveError}=await createSupabaseAdminClient().rpc('save_nda_layout',{actor:user.id,target_listing:id,expected_version:version,layout});
  if(saveError)throw Error('The template could not be saved. Reload and try again.');
  revalidatePath(`/${locale}/dashboard/listings`);
  return {url:`/${locale}/dashboard/listings/${id}/prepare-nda?saved=1`};
 }catch(e){return {error:e instanceof z.ZodError?'Check field positions, sizes, and required signature. Fields must not overlap.':e instanceof Error?e.message:'Could not save fields'};}
}
export async function signPreparedPdf(data:FormData):Promise<{error?:string;url?:string}> {
 const locale=data.get('locale')==='es'?'es':'en';
 try {
  const id=z.string().uuid().parse(data.get('nda_id'));
  if(data.get('accepted')!=='on')throw Error('Confirm your agreement to sign electronically');
  const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)throw Error('Sign in again');
  const {data:nda}=await db.from('deal_ndas').select('*').eq('id',id).eq('buyer_id',user.id).single();
  if(!nda)throw Error('Agreement unavailable');
  if(nda.status==='signed')return {url:`/${locale}/dashboard/deals/${nda.inquiry_id}/agreement`};
  const {data:controls,error:controlsError}=await db.from('deal_nda_controls').select('*').eq('nda_id',nda.id).maybeSingle();
  if(controlsError||!['sent','viewed'].includes(signingState(nda.status,controls)))throw Error('This signing request is no longer available.');
  const layout=parseNdaLayout(nda.signing_layout);
  if(data.get('revision')!==layout.revision)throw Error('Signing fields changed. Reload before signing.');
  const completedRaw=String(data.get('completed')??'');if(completedRaw.length>5000)throw Error('Invalid field confirmation');
  const completed=z.array(z.string().uuid()).max(50).parse(JSON.parse(completedRaw));
  const stamp=new Date(),name=String(data.get('signer_name')??'').trim();
  const values=valuesForFields(layout.fields,name,String(data.get('initials')??''),completed,stamp);
  const {data:file,error}=await db.storage.from('deal-files').download(nda.storage_path);if(error||!file)throw Error('Original PDF unavailable. Nothing was signed.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const output=await completeSigningPdf(bytes,layout,values);
  const admin=createSupabaseAdminClient(),path=`${nda.id}/${randomUUID()}.pdf`,hash=pdfHash(output);
  const {error:uploadError}=await admin.storage.from('signed-agreements').upload(path,output,{contentType:'application/pdf',upsert:false});
  if(uploadError)throw Error('The completed PDF could not be stored. Nothing was signed. Try again.');
  const fingerprint=pdfHash(Buffer.from(JSON.stringify({original_sha256:layout.sha256,layout,values,completed_pdf_sha256:hash})));
  const {error:signError}=await admin.rpc('complete_visual_nda',{actor:user.id,target_nda:nda.id,expected_layout:layout,legal_name:name,fingerprint,output_path:path,output_sha256:hash,field_values:values,completed_at:stamp.toISOString(),locale});
  // Do not delete on an ambiguous RPC/network result: the transaction may have
  // committed. Unreferenced generated objects remain private for reconciliation.
  if(signError)throw Error('Signing could not be confirmed. Refresh to check its status; an expired or withdrawn request cannot be signed.');
  revalidatePath(`/${locale}/dashboard/deals/${nda.inquiry_id}`);revalidatePath(`/${locale}/dashboard/signing`);
  return {url:`/${locale}/dashboard/deals/${nda.inquiry_id}/agreement`};
 }catch(e){return {error:e instanceof z.ZodError?'Check your name, initials, and all required fields.':e instanceof Error?e.message:'Signing unavailable'};}
}
