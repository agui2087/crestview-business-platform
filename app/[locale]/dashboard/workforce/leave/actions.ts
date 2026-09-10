"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';
export async function leaveOperation(form:FormData) {
  const get=(key:string)=>String(form.get(key)??'').trim();
  const locale=isLocale(get('locale'))?get('locale'):'en';
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
  const owner=get('owner')||user.id;let policy=get('policy');let failed=true;
  if(get('operation')==='adopt'&&get('confirmed')==='yes'&&/^\d+$/.test(get('accrual'))&&(!get('cap')||/^\d+$/.test(get('cap')))) {
    const r=await db.rpc('workforce_adopt_leave_policy',{p_employee:get('employee'),p_type:get('type'),p_start:get('start'),p_end:get('end')||null,p_accrual:Number(get('accrual')),p_cap:get('cap')?Number(get('cap')):null,p_exclude_holidays:get('exclude')==='true',p_holidays:get('holidays').split(/\s+/).filter(Boolean),p_review:get('review'),p_cadence:get('cadence')});
    failed=Boolean(r.error);if(!failed)policy=String(r.data);
  }
  if(get('operation')==='post'&&/^-?\d+$/.test(get('minutes'))) {const r=await db.rpc('workforce_post_leave_entry',{p_policy:policy,p_date:get('date'),p_kind:get('kind'),p_minutes:Number(get('minutes')),p_reference:get('reference'),p_reason:get('reason')});failed=Boolean(r.error);}
  if(get('operation')==='close') {const r=await db.rpc('workforce_close_leave_policy',{p_policy:policy,p_version:Number(get('version')),p_end:get('end'),p_reason:get('reason')});failed=Boolean(r.error);}
  const path=`/${locale}/dashboard/workforce/leave`;revalidatePath(path);
  redirect(`${path}?owner=${encodeURIComponent(owner)}&policy=${encodeURIComponent(policy)}&notice=${failed?'failed':'saved'}`);
}
