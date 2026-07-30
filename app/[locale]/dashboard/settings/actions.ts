"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";

function moneyValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function saveBuyerPreferences(formData: FormData) {
  const localeValue = String(formData.get("locale") ?? "en");
  if (!isLocale(localeValue)) redirect("/en/sign-in");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${localeValue}/sign-in`);

  const splitList = (name: string) =>
    String(formData.get(name) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const { error } = await supabase.from("buyer_preferences").upsert({
    user_id: user.id,
    industries: splitList("industries"),
    locations: splitList("locations"),
    minimum_price: moneyValue(formData.get("minimum_price")),
    maximum_price: moneyValue(formData.get("maximum_price")),
    minimum_cash_flow: moneyValue(formData.get("minimum_cash_flow")),
    owner_involvement: String(formData.get("owner_involvement") ?? "flexible"),
    seller_financing_preferred: formData.get("seller_financing_preferred") === "on",
    experience_level: String(formData.get("experience_level") ?? "first_time"),
    acquisition_timeline: String(formData.get("acquisition_timeline") ?? "exploring"),
    funding_status: String(formData.get("funding_status") ?? "exploring"),
    proof_of_funds_status: formData.get("proof_of_funds_available") === "on" ? "available" : "not_provided",
    buyer_summary: String(formData.get("buyer_summary") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

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
  await supabase.from("profiles").update({
    display_name: String(formData.get("display_name") ?? "").trim() || null,
    job_title: String(formData.get("job_title") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    organization_name: String(formData.get("organization_name") ?? "").trim() || "Crestview Holdings",
    locale: localeValue,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }).eq("user_id", user.id);
  revalidatePath(`/${localeValue}/dashboard`, "layout");
  redirect(`/${localeValue}/dashboard/settings?profile=1`);
}
