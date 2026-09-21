'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {z} from 'zod';
import {createHash} from 'node:crypto';
export async function manageAgreement(data:FormData) {
 const parsed=z.object({locale:z.enum(['en','es']),inquiry:z.string().uuid(),nda:z.string().uuid(),version:z.coerce.number().int().positive(),operation:z.enum(['receipt','remind','expire','withdraw'])}).safeParse({locale:data.get('locale'),inquiry:data.get('inquiry_id'),nda:data.get('nda_id'),version:data.get('nda_version'),operation:data.get('operation')});
 if(!parsed.success)redirect('/en/dashboard/inbox');
 const p=parsed.data;const target=`/${p.locale}/dashboard/deals/${p.inquiry}`;
 const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect(`/${p.locale}/sign-in`);
 const {data:nda}=await supabase.from('deal_ndas').select('id').eq('id',p.nda).eq('inquiry_id',p.inquiry).maybeSingle();
 if(!nda)redirect(`/${p.locale}/dashboard/inbox`);
 if(p.operation==='withdraw'&&data.get('confirmed')!=='on')redirect(`${target}?signing=invalid#deal-conversation`);
 const {error}=await supabase.rpc('manage_deal_nda',{target_nda:p.nda,expected_version:p.version,operation:p.operation,expiry_days:p.operation==='expire'?Number(data.get('expiry_days')):null,reason:p.operation==='withdraw'?String(data.get('reason')??''):null,locale:p.locale});
 revalidatePath(target);revalidatePath(`/${p.locale}/dashboard/signing`);
 redirect(`${target}?signing=${error?'unavailable':p.operation}#deal-conversation`);
}
export async function declineAgreement(data:FormData) {
 const parsed=z.object({locale:z.enum(['en','es']),inquiry:z.string().uuid(),nda:z.string().uuid(),version:z.coerce.number().int().positive(),reason:z.string().trim().min(10).max(1000),confirmed:z.literal('on')}).safeParse({locale:data.get('locale'),inquiry:data.get('inquiry_id'),nda:data.get('nda_id'),version:data.get('nda_version'),reason:data.get('reason'),confirmed:data.get('confirmed')});
 if(!parsed.success)redirect('/en/dashboard/signing');
 const p=parsed.data,db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect(`/${p.locale}/sign-in`);
 const {data:nda}=await db.from('deal_ndas').select('id').eq('id',p.nda).eq('inquiry_id',p.inquiry).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();if(!nda)redirect(`/${p.locale}/dashboard/signing`);
 const {error}=await createSupabaseAdminClient().rpc('decline_nda_request',{actor:user.id,target_nda:p.nda,expected_version:p.version,reason:p.reason,locale:p.locale});
 revalidatePath(`/${p.locale}/dashboard/deals/${p.inquiry}`);revalidatePath(`/${p.locale}/dashboard/signing`);
 redirect(`/${p.locale}/dashboard/deals/${p.inquiry}?signing=${error?'unavailable':'declined'}#deal-conversation`);
}

export async function reissueAgreement(data:FormData) {
 const parsed=z.object({locale:z.enum(['en','es']),inquiry:z.string().uuid(),nda:z.string().uuid(),version:z.coerce.number().int().positive(),template:z.coerce.number().int().positive(),reason:z.string().trim().min(10).max(1000),confirmed:z.literal('on')}).safeParse({locale:data.get('locale'),inquiry:data.get('inquiry_id'),nda:data.get('nda_id'),version:data.get('nda_version'),template:data.get('template_version'),reason:data.get('reason'),confirmed:data.get('confirmed')});
 if(!parsed.success)redirect('/en/dashboard/signing');
 const p=parsed.data,db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect(`/${p.locale}/sign-in`);
 const target=`/${p.locale}/dashboard/deals/${p.inquiry}`;
 const {data:inquiry,error:inquiryError}=await db.from('deal_inquiries').select('listing_id').eq('id',p.inquiry).eq('broker_id',user.id).maybeSingle();
 if(inquiryError||!inquiry)redirect(`/${p.locale}/dashboard/signing`);
 const [{data:nda,error:ndaError},{data:template,error:templateError}]=await Promise.all([
  db.from('deal_ndas').select('storage_path,template_version').eq('id',p.nda).eq('inquiry_id',p.inquiry).eq('broker_id',user.id).maybeSingle(),
  db.from('listing_nda_templates').select('storage_path,version').eq('listing_id',inquiry.listing_id).eq('broker_id',user.id).maybeSingle(),
 ]);
 if(ndaError||templateError||!nda||!template||nda.template_version!==p.version||template.version!==p.template)redirect(`${target}/reissue?error=changed`);
 const admin=createSupabaseAdminClient();let failed=false;
 try{
  const hash=async(path:string|null)=>{if(!path)return null;const {data:file,error}=await admin.storage.from('deal-files').download(path);if(error||!file||file.size>3_500_000)throw Error('Original unavailable');return createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');};
  const [oldHash,newHash]=await Promise.all([hash(nda.storage_path),hash(template.storage_path)]);
  const {error}=await admin.rpc('reissue_nda_request',{actor:user.id,target_nda:p.nda,expected_version:p.version,expected_template_version:p.template,reason:p.reason,old_sha256:oldHash,new_sha256:newHash,locale:p.locale});
  failed=!!error;
 }catch{failed=true;}
 if(failed)redirect(`${target}/reissue?error=unavailable`);
 revalidatePath(target);revalidatePath(`${target}/sign`);revalidatePath(`/${p.locale}/dashboard/signing`);
 redirect(`${target}/reissue?reissued=1`);
}
