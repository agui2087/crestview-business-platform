"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";

const stages = new Set(["saved", "screening", "evaluating", "diligence", "negotiation", "closing", "complete", "passed"]);

export async function updateDealStage(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!isLocale(locale) || !id || !stages.has(stage)) redirect("/en/dashboard/pipeline");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  await supabase
    .from("saved_opportunities")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath(`/${locale}/dashboard/pipeline`);
}
