"use server";
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';
export async function saveFollowupPause(form:FormData){
 const locale=String(form.get('locale'));if(!isLocale(locale))redirect('/en/sign-in');
 const id=z.string().uuid().safeParse(form.get('inquiry_id'));if(!id.success)redirect(`/${locale}/dashboard/inbox`);
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {error}=await db.from('buyer_followup_preferences').upsert({inquiry_id:id.data,buyer_id:user.id,paused:form.get('paused')==='on'});
 if(error)redirect(`/${locale}/dashboard/deals/${id.data}?followup=error`);
 revalidatePath(`/${locale}/dashboard/deals/${id.data}`);
 redirect(`/${locale}/dashboard/deals/${id.data}?followup=saved`);
}
