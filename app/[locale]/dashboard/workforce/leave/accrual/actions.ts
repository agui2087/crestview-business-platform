'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export async function saveAccrual(form:FormData) {
  const get=(key:string)=>String(form.get(key)??'').trim();
  const locale=isLocale(get('locale'))?get('locale'):'en';
  const db=await createSupabaseServerClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)redirect(`/${locale}/sign-in`);
  let failed=true;
  if(get('operation')==='enable'&&get('confirmed')==='yes'&&/^\d+$/.test(get('amount'))&&/^-?\d+$/.test(get('balance'))) {
    const result=await db.rpc('workforce_configure_accrual',{
      p_policy:get('policy'),p_policy_version:Number(get('policy_version')),p_rule_version:Number(get('version')),
      p_amount:Number(get('amount')),p_expected_balance:Number(get('balance')),p_review:get('review'),
    });
    failed=Boolean(result.error);
  }
  if(get('operation')==='pause') {
    const result=await db.rpc('workforce_pause_accrual',{p_policy:get('policy'),p_version:Number(get('version')),p_reason:get('review')});
    failed=Boolean(result.error);
  }
  const path=`/${locale}/dashboard/workforce/leave/accrual`;
  revalidatePath(path);revalidatePath(`/${locale}/dashboard/workforce/leave`);
  redirect(`${path}?policy=${encodeURIComponent(get('policy'))}&notice=${failed?'failed':'saved'}`);
}
