"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveSchedule(form:FormData) {
  const get=(key:string)=>String(form.get(key)??"").trim();
  const locale=isLocale(get("locale"))?get("locale"):"en";
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();
  if(!user)redirect(`/${locale}/sign-in`);
  const owner=get("owner")||user.id;
  const minutes=Array.from({length:7},(_,i)=>get(`day${i}`));
  let failed=true;
  if(minutes.every(n=>/^\d{1,4}$/.test(n)&&Number(n)<=1440)) {
    const result=await db.rpc("workforce_save_schedule",{p_employee:get("employee"),p_id:get("id")||null,p_version:Number(get("version")),p_start:get("start"),p_end:get("end")||null,p_timezone:get("timezone"),p_minutes:minutes.map(Number),p_reason:get("reason"),p_cancelled:get("cancelled")==="true"});
    failed=Boolean(result.error);
  }
  const path=`/${locale}/dashboard/workforce/schedules`;
  revalidatePath(path);
  redirect(`${path}?owner=${encodeURIComponent(owner)}&notice=${failed?"failed":"saved"}`);
}
