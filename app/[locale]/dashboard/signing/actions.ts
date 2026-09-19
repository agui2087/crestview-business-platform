'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {z} from 'zod';
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
