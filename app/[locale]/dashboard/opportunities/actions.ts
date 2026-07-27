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
  await supabase.from("deal_activities").insert({ user_id: user.id, opportunity_key: opportunityKey, activity_type: "saved", description: "Opportunity saved." });
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
  await supabase.from("deal_activities").insert({ user_id: user.id, opportunity_key: opportunityKey, activity_type: "stage", description: "Acquisition screening started." });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
  revalidatePath(`/${locale}/dashboard/pipeline`);
  redirect(`/${locale}/dashboard/pipeline`);
}

function safeJson(value: FormDataEntryValue | null, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveAcquisitionWorkspace(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const currentStep = Math.max(0, Math.min(7, Number(formData.get("current_step")) || 0));
  const checklistProgress = safeJson(formData.get("checklist_progress"), {});
  const stepNotes = safeJson(formData.get("step_notes"), {});
  const valuationInputs = safeJson(formData.get("valuation_inputs"), {});
  const { error } = await supabase.from("saved_opportunities").upsert({
    user_id: user.id,
    opportunity_key: opportunityKey,
    stage: currentStep >= 5 ? "diligence" : currentStep >= 2 ? "evaluating" : "screening",
    current_step: currentStep,
    checklist_progress: checklistProgress,
    step_notes: stepNotes,
    valuation_inputs: valuationInputs,
    next_action: currentStep === 7 ? "Confirm closing and transition obligations" : `Continue acquisition checklist at step ${currentStep + 1}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,opportunity_key" });
  if (error) return { ok: false, message: "Progress could not be saved." };
  await supabase.from("deal_activities").insert({
    user_id: user.id, opportunity_key: opportunityKey, activity_type: "progress",
    description: `Acquisition workspace saved at step ${currentStep + 1}.`,
  });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
  revalidatePath(`/${locale}/dashboard/pipeline`);
  return { ok: true, message: "Progress saved." };
}

export async function addDiligenceItem(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const title = String(formData.get("title") ?? "").trim();
  if (title) await supabase.from("diligence_items").upsert({
    user_id: user.id, opportunity_key: opportunityKey,
    category: String(formData.get("category") ?? "Financial"), title,
    due_date: String(formData.get("due_date") ?? "") || null,
  }, { onConflict: "user_id,opportunity_key,category,title" });
  await supabase.from("deal_activities").insert({ user_id: user.id, opportunity_key: opportunityKey, activity_type: "diligence", description: `Diligence item added: ${title}` });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

export async function updateDiligenceItem(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  await supabase.from("diligence_items").update({ status: String(formData.get("status")), updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("id"))).eq("user_id", user.id);
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

export async function addBrokerInteraction(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const summary = String(formData.get("summary") ?? "").trim();
  if (summary) await supabase.from("broker_interactions").insert({
    user_id: user.id, opportunity_key: opportunityKey,
    contact_name: String(formData.get("contact_name") ?? "") || null,
    interaction_type: String(formData.get("interaction_type") ?? "note"),
    summary,
  });
  await supabase.from("deal_activities").insert({ user_id: user.id, opportunity_key: opportunityKey, activity_type: "broker", description: summary });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}
