"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

async function authenticatedRequest(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  const opportunityKey = String(formData.get("opportunity_key") ?? "");
  if (!isLocale(locale) || !getOpportunity(opportunityKey)) redirect("/en/dashboard/opportunities");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return { locale, opportunityKey, supabase, user };
}

export async function saveOpportunity(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  await supabase.from("saved_opportunities").upsert({
    user_id: user.id,
    opportunity_key: opportunityKey,
    stage: "saved",
    next_action: "Review the public listing and request missing information",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,opportunity_key", ignoreDuplicates: true });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
  revalidatePath(`/${locale}/dashboard/pipeline`);
}

export async function beginAcquisition(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  await supabase.from("saved_opportunities").upsert({
    user_id: user.id,
    opportunity_key: opportunityKey,
    stage: "screening",
    next_action: "Complete initial screening and confirm listing availability",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,opportunity_key" });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
  revalidatePath(`/${locale}/dashboard/pipeline`);
  redirect(`/${locale}/dashboard/pipeline`);
}
