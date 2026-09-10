"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {parsePayrollCsv} from '@/lib/workforce-payroll';

export async function importPayroll(_previous:{error:string},form:FormData):Promise<{error:string}> {
  const locale=isLocale(String(form.get('locale')))?String(form.get('locale')):'en';
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();
  if(!user)redirect(`/${locale}/sign-in`);
  const owner=String(form.get('owner')||user.id);
  const role=await db.rpc('workforce_role',{p_owner:owner});
  if(role.error||!['owner','hr'].includes(role.data??''))return {error:locale==='es'?'Acceso denegado.':'Access denied.'};
  if(form.get('reviewed')!=='yes')return {error:locale==='es'?'Confirma la revisión.':'Confirm your review.'};
  let rows;
  try {rows=parsePayrollCsv(String(form.get('csv')??''));}catch {return {error:locale==='es'?'CSV inválido. Revisa la vista previa.':'Invalid CSV. Check the preview.'};}
  const result=await db.rpc('workforce_import_payroll',{p_owner:owner,p_reference:String(form.get('reference')??'').trim(),p_rows:rows});
  if(result.error)return {error:locale==='es'?'No guardado. Revisa empleados, períodos superpuestos y referencias ya usadas. No se importó un lote parcial.':'Not saved. Check employee access, overlapping periods and previously used references. No partial batch was imported.'};
  const path=`/${locale}/dashboard/workforce/payroll`;revalidatePath(path);
  redirect(`${path}?owner=${encodeURIComponent(owner)}&batch=${encodeURIComponent(String(result.data))}&notice=saved`);
}
export async function voidPayroll(form:FormData) {
  const locale=isLocale(String(form.get('locale')))?String(form.get('locale')):'en';
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
  const owner=String(form.get('owner')||user.id),batch=String(form.get('batch')??'');
  const result=form.get('confirmed')==='yes'?await db.rpc('workforce_void_payroll',{p_import:batch,p_reason:String(form.get('reason')??'')}):{error:true};
  const path=`/${locale}/dashboard/workforce/payroll`;revalidatePath(path);
  redirect(`${path}?owner=${encodeURIComponent(owner)}&batch=${encodeURIComponent(batch)}&notice=${result.error?'failed':'voided'}`);
}
