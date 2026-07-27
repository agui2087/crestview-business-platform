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
    maximum_price: moneyValue(formData.get("maximum_price")),
    minimum_cash_flow: moneyValue(formData.get("minimum_cash_flow")),
    owner_involvement: String(formData.get("owner_involvement") ?? "flexible"),
    seller_financing_preferred: formData.get("seller_financing_preferred") === "on",
    experience_level: String(formData.get("experience_level") ?? "first_time"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) redirect(`/${localeValue}/dashboard/settings?error=save`);
  revalidatePath(`/${localeValue}/dashboard/settings`);
  revalidatePath(`/${localeValue}/dashboard/opportunities`);
  redirect(`/${localeValue}/dashboard/settings?saved=1`);
}
