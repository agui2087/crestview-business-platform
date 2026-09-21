import {createClient} from '@supabase/supabase-js';
import {sendSigningEmail,emailRetryAt} from '../lib/signing-email.ts';

// Dedicated worker; never embed credentials in a browser or public workflow log.
// Run only after the sender domain and provider's ongoing-free plan are verified.
const env=process.env;
if(env.SIGNING_EMAIL_ENABLED!=='true')throw Error('Signing email delivery is disabled');
for(const key of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','SIGNING_EMAIL_FROM','SIGNING_EMAIL_ORIGIN'])if(!env[key])throw Error(`Missing ${key}`);
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL!,env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:jobs,error}=await db.rpc('claim_signing_emails',{batch_size:5});
if(error)throw Error('Could not claim email jobs');
const counts={claimed:jobs?.length??0,sent:0,retry:0,failed:0,cancelled:0,leaseLost:0};
for(const job of jobs??[]){
 const {data:nda,error:ndaError}=await db.from('deal_ndas').select('inquiry_id,status,buyer_id,broker_id,template_version').eq('id',job.nda_id).maybeSingle();
 const {data:controls,error:controlError}=await db.from('deal_nda_controls').select('withdrawn_at,expires_at').eq('nda_id',job.nda_id).maybeSingle();
 if(ndaError||controlError)throw Error('Could not verify signing request');
 const unavailable=!nda||nda.template_version!==job.nda_version||![nda.buyer_id,nda.broker_id].includes(job.recipient_id)||(job.kind==='completed'?nda.status!=='signed':!['sent','viewed'].includes(nda.status)||!!controls?.withdrawn_at||!!controls?.expires_at&&Date.parse(controls.expires_at)<=Date.now());
 let update:Record<string,unknown>;
 if(unavailable){update={state:'cancelled',last_error:'agreement_unavailable'};counts.cancelled++;}
 else {
  const {data:{user},error:userError}=await db.auth.admin.getUserById(job.recipient_id);
  if(userError)throw Error('Could not verify email recipient');
  if(!user?.email||!user.email_confirmed_at){update={state:'failed',last_error:'recipient_unverified'};counts.failed++;}
  else {
   const result=await sendSigningEmail({id:job.id,recipient:user.email,inquiryId:nda.inquiry_id,locale:job.locale,kind:job.kind},{apiKey:env.RESEND_API_KEY!,from:env.SIGNING_EMAIL_FROM!,origin:env.SIGNING_EMAIL_ORIGIN!});
   if(result.state==='sent'){update={state:'sent',provider_id:result.providerId,sent_at:new Date().toISOString(),last_error:null};counts.sent++;}
   else {
    const retry=result.state==='retry'?emailRetryAt(job.attempts,Date.parse(job.first_attempt_at)):null;
    update={state:retry?'retry':'failed',last_error:result.code,...(retry?{available_at:new Date(retry).toISOString()}:{})};
    if(retry)counts.retry++;else counts.failed++;
   }
  }
 }
 // A stale worker must not overwrite a replacement worker's claim.
 const {data:updated,error:saveError}=await db.from('signing_email_outbox').update({...update,lease_until:null,lease_id:null}).eq('id',job.id).eq('state','sending').eq('lease_id',job.lease_id).select('id');
 if(saveError)throw Error('Email outcome could not be saved; reconcile before resending');
 if(!updated?.length)counts.leaseLost++;
}
console.log(JSON.stringify(counts));
