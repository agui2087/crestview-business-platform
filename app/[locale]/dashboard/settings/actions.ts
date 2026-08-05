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

  const availableCash = moneyValue(formData.get("available_cash"));
  const desiredOwnerIncome = moneyValue(formData.get("desired_owner_income"));
  const injectionPercent = Math.min(50, Math.max(5, Number(formData.get("buyer_injection_percent")) || 15));
  const illustrativeInterestRate = Math.min(30, Math.max(0, Number(formData.get("illustrative_interest_rate")) || 11));
  const estimatedMaximum = availableCash ? Math.round(availableCash / (injectionPercent / 100 + 0.05)) : moneyValue(formData.get("maximum_price"));

  const [{ error }, { error: financialError }] = await Promise.all([
    supabase.from("buyer_preferences").upsert({
    user_id: user.id,
    industries: splitList("industries"),
    locations: splitList("locations"),
    minimum_price: moneyValue(formData.get("minimum_price")),
    maximum_price: estimatedMaximum,
    minimum_cash_flow: moneyValue(formData.get("minimum_cash_flow")),
    desired_owner_income: desiredOwnerIncome,
    owner_involvement: String(formData.get("owner_involvement") ?? "flexible"),
    seller_financing_preferred: formData.get("seller_financing_preferred") === "on",
    experience_level: String(formData.get("experience_level") ?? "first_time"),
    acquisition_timeline: String(formData.get("acquisition_timeline") ?? "exploring"),
    funding_status: String(formData.get("funding_status") ?? "exploring"),
    proof_of_funds_status: formData.get("proof_of_funds_available") === "on" ? "available" : "not_provided",
    buyer_summary: String(formData.get("buyer_summary") ?? "").trim() || null,
    risk_tolerance: String(formData.get("risk_tolerance") ?? "balanced"),
    share_summary: String(formData.get("share_summary") ?? "inquiry"),
    share_experience: String(formData.get("share_experience") ?? "inquiry"),
    updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }),
    supabase.from("buyer_financial_profiles").upsert({
      user_id: user.id,
      available_cash: availableCash,
      buyer_injection_percent: injectionPercent,
      illustrative_interest_rate: illustrativeInterestRate,
      credit_readiness: String(formData.get("credit_readiness") ?? "not_provided"),
      share_financial: String(formData.get("share_financial") ?? "nda"),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }),
  ]);

  if (error || financialError) redirect(`/${localeValue}/dashboard/settings?error=save`);
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
