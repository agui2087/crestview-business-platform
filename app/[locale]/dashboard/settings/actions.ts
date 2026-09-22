"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { accountProfileSchema } from "@/lib/account-profile";
import { parseBuyerProfile } from "@/lib/buyer-profile";

export async function saveBuyerPreferences(formData: FormData) {
  const localeValue = String(formData.get("locale") ?? "en");
  if (!isLocale(localeValue)) redirect("/en/sign-in");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${localeValue}/sign-in`);
  const parsed = parseBuyerProfile(formData);
  if (!parsed.success) redirect(`/${localeValue}/dashboard/settings?error=buyer_invalid`);
  const { error } = await supabase.rpc("save_my_buyer_profile", { payload: parsed.data });
  if (error) redirect(`/${localeValue}/dashboard/settings?error=save`);
  revalidatePath(`/${localeValue}/dashboard/settings`);
  revalidatePath(`/${localeValue}/dashboard/opportunities`);
  redirect(`/${localeValue}/dashboard/settings?saved=1`);
}

export async function saveAccountProfile(formData: FormData) {
  const localeValue = String(formData.get("locale") ?? "en");
  if (!isLocale(localeValue)) redirect("/en/sign-in");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${localeValue}/sign-in`);
  const parsed = accountProfileSchema.safeParse({
    display_name: formData.get("display_name") ?? "",
    job_title: formData.get("job_title") ?? "",
    phone: formData.get("phone") ?? "",
    organization_name: formData.get("organization_name") ?? "",
  });
  if (!parsed.success) redirect(`/${localeValue}/dashboard/settings?error=profile_invalid`);
  const { data, error } = await supabase.from("profiles").update({
    ...parsed.data,
    locale: localeValue,
    onboarding_completed: true,
  }).eq("user_id", user.id).select("user_id").maybeSingle();
  if (error || !data) redirect(`/${localeValue}/dashboard/settings?error=profile_save`);
  revalidatePath(`/${localeValue}/dashboard`, "layout");
  redirect(`/${localeValue}/dashboard/settings?profile=1`);
}
