"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import {dealTaskInput,dealTaskUpdate} from '@/lib/deal-task-input';
import {resolveOpportunity} from '@/lib/opportunity-resolver';

async function context(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (!isLocale(locale)) redirect("/en/dashboard/tasks");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return { locale, supabase, user };
}

export async function createTask(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const parsed=dealTaskInput.safeParse(Object.fromEntries(formData));
  if(!parsed.success)redirect(`/${locale}/dashboard/tasks?error=invalid`);
  if(parsed.data.opportunity_key&&!await resolveOpportunity(parsed.data.opportunity_key,locale))redirect(`/${locale}/dashboard/tasks?error=opportunity`);
  const {error}=await supabase.from('deal_tasks').insert({user_id:user.id,...parsed.data});
  if(error)redirect(`/${locale}/dashboard/tasks?error=save`);
  revalidatePath(`/${locale}/dashboard/tasks`);
  redirect(`/${locale}/dashboard/tasks?saved=1`);
}

export async function toggleTask(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const parsed=dealTaskUpdate.safeParse(Object.fromEntries(formData));
  if(!parsed.success)redirect(`/${locale}/dashboard/tasks?error=invalid`);
  const {data,error}=await supabase.from("deal_tasks").update({
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  }).eq("id",parsed.data.id).eq("user_id", user.id).select('id').maybeSingle();
  if(error||!data)redirect(`/${locale}/dashboard/tasks?error=save`);
  revalidatePath(`/${locale}/dashboard/tasks`);
  redirect(`/${locale}/dashboard/tasks?saved=1`);
}
