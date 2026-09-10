"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
export async function evidenceOperation(form:FormData) {
  const get=(k:string)=>String(form.get(k)??'').trim();
  const locale=isLocale(get('locale'))?get('locale'):'en';
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
  let failed=true;
  if(get('confirmed')==='yes'&&get('operation')==='share'){
    const r=await db.rpc('workforce_share_training_evidence',{p_task:get('task'),p_version:Number(get('version')),p_document:get('document')});failed=Boolean(r.error);
  }
  if(get('confirmed')==='yes'&&get('operation')==='revoke'){
    const r=await db.rpc('workforce_revoke_training_evidence',{p_evidence:get('evidence'),p_reason:get('reason')});failed=Boolean(r.error);
  }
  const path=`/${locale}/dashboard/workforce/evidence`;revalidatePath(path);
  redirect(`${path}?owner=${encodeURIComponent(get('owner')||user.id)}&task=${encodeURIComponent(get('task'))}&notice=${failed?'failed':'saved'}`);
}
