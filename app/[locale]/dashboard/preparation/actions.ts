'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {preparationSchema} from '@/lib/buyer-preparation';
export async function savePreparation(form:FormData){
 const locale=String(form.get('locale'));if(!isLocale(locale))redirect('/en/sign-in');
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const parsed=preparationSchema.safeParse({path:form.get('path'),completed_steps:form.getAll('completed_steps')});if(!parsed.success)redirect(`/${locale}/dashboard/preparation?error=validation`);
 const {error}=await db.from('buyer_preparation').upsert({user_id:user.id,...parsed.data},{onConflict:'user_id'});if(error)redirect(`/${locale}/dashboard/preparation?error=save`);
 revalidatePath(`/${locale}/dashboard/preparation`);redirect(`/${locale}/dashboard/preparation?saved=1`);
}
