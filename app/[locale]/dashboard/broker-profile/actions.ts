'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {brokerProfileFields,brokerProfileSchema} from '@/lib/broker-profile';

export async function saveBrokerProfile(form:FormData){
 const locale=String(form.get('locale'));if(!isLocale(locale))redirect('/en/sign-in');
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect(`/${locale}/sign-in`);
 const {data:account,error:accountError}=await db.from('profiles').select('account_roles').eq('user_id',user.id).maybeSingle();
 if(accountError||!account?.account_roles?.includes('broker'))redirect(`/${locale}/dashboard/settings`);
 const parsed=brokerProfileSchema.safeParse({...Object.fromEntries(brokerProfileFields.map(k=>[k,String(form.get(k)??'')])),welcomes_preparing_buyers:form.get('welcomes_preparing_buyers')==='on',published:form.get('published')==='on'});
 if(!parsed.success)redirect(`/${locale}/dashboard/broker-profile?error=validation`);
 const {error}=await db.from('broker_profiles').upsert({user_id:user.id,...parsed.data},{onConflict:'user_id'});
 if(error)redirect(`/${locale}/dashboard/broker-profile?error=save`);
 revalidatePath(`/${locale}/dashboard/broker-profile`);revalidatePath(`/${locale}/brokers`);revalidatePath(`/${locale}/brokers/${user.id}`);
 redirect(`/${locale}/dashboard/broker-profile?saved=1`);
}
