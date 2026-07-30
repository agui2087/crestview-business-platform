"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { buildGuidedChecklist, type GuidanceProfile } from "@/lib/guided-acquisition";

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

export async function addDiligenceTemplate(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const template = String(formData.get("template") ?? "general");
  const shared = [
    ["Financial", "Reconcile tax returns to financial statements"],
    ["Financial", "Verify revenue through bank statements"],
    ["Legal", "Review entity, contracts, liens, and litigation"],
    ["Operational", "Document owner responsibilities and transition"],
    ["Customer", "Analyze customer concentration and retention"],
  ];
  const specialized = template === "service"
    ? [["Employee", "Verify licenses, certifications, and technician retention"], ["Operational", "Review fleet, equipment, and service agreements"]]
    : template === "retail"
      ? [["Operational", "Count and value inventory"], ["Legal", "Review lease terms and assignment"]]
      : template === "healthcare"
        ? [["Compliance", "Review licensing, credentialing, privacy, and billing compliance"], ["Employee", "Review provider agreements and retention"]]
        : [["Compliance", "Identify required permits and regulatory obligations"]];
  await supabase.from("diligence_items").upsert(
    [...shared, ...specialized].map(([category, title]) => ({ user_id: user.id, opportunity_key: opportunityKey, category, title })),
    { onConflict: "user_id,opportunity_key,category,title" },
  );
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

export async function updateDiligenceItem(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  await supabase.from("diligence_items").update({ status: String(formData.get("status")), updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("id"))).eq("user_id", user.id);
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function generateGuidedPlan(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const profile: GuidanceProfile = {
    industry_type: String(formData.get("industry_type") ?? "general"),
    purchase_structure: String(formData.get("purchase_structure") ?? "asset"),
    financing_type: String(formData.get("financing_type") ?? "sba"),
    state_code: String(formData.get("state_code") ?? "OR").slice(0, 2).toUpperCase(),
    has_employees: checked(formData, "has_employees"),
    includes_real_estate: checked(formData, "includes_real_estate"),
    includes_inventory: checked(formData, "includes_inventory"),
    first_acquisition: checked(formData, "first_acquisition"),
  };
  await supabase.from("deal_guidance_profiles").upsert({
    user_id: user.id, opportunity_key: opportunityKey, ...profile,
    generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,opportunity_key" });
  await supabase.from("diligence_items").upsert(
    buildGuidedChecklist(profile).map((item) => ({
      user_id: user.id, opportunity_key: opportunityKey, ...item, is_dynamic: true,
    })),
    { onConflict: "user_id,opportunity_key,category,title" },
  );
  const transition = [
    ["before_close", "Closing", "Confirm funds flow, signatures, insurance, licenses, and access handoff"],
    ["day_1", "People", "Introduce ownership, confirm payroll, and communicate the first-week plan"],
    ["day_30", "Operations", "Stabilize customers, vendors, cash controls, and weekly reporting"],
    ["day_60", "Performance", "Compare actual results with the acquisition model and address gaps"],
    ["day_90", "Improvement", "Prioritize growth projects only after core operations are stable"],
    ["year_1", "Review", "Complete the first-year tax, covenant, insurance, and strategy review"],
  ];
  await supabase.from("transition_items").upsert(
    transition.map(([horizon, category, title]) => ({ user_id: user.id, opportunity_key: opportunityKey, horizon, category, title, owner: "Buyer" })),
    { onConflict: "user_id,opportunity_key,horizon,title" },
  );
  await supabase.from("deal_activities").insert({
    user_id: user.id, opportunity_key: opportunityKey, activity_type: "guided_plan",
    description: "A deal-specific acquisition plan was generated.",
  });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

export async function addDiligenceEvidence(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const itemId = String(formData.get("diligence_item_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const evidenceType = String(formData.get("evidence_type") ?? "document");
  const { data: item } = await supabase.from("diligence_items").select("id").eq("id", itemId).eq("user_id", user.id).maybeSingle();
  if (item && label) {
    await supabase.from("diligence_evidence").insert({
      user_id: user.id, opportunity_key: opportunityKey, diligence_item_id: item.id,
      label, evidence_type: evidenceType, source_url: sourceUrl || null,
    });
    await supabase.from("diligence_items").update({ status: "received", updated_at: new Date().toISOString() }).eq("id", item.id).eq("user_id", user.id);
  }
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

export async function saveSbaReadiness(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const number = (name: string, fallback = 0) => Math.max(0, Number(formData.get(name)) || fallback);
  await supabase.from("sba_readiness_profiles").upsert({
    user_id: user.id, opportunity_key: opportunityKey,
    purchase_price: number("purchase_price"), buyer_injection: number("buyer_injection"),
    seller_note: number("seller_note"), working_capital: number("working_capital"),
    annual_cash_flow: number("annual_cash_flow"), interest_rate: number("interest_rate", 10.5),
    term_years: Math.max(1, Math.min(25, number("term_years", 10))),
    lender_status: String(formData.get("lender_status") ?? "not_started"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,opportunity_key" });
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

export async function addDealProfessional(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (displayName) {
    await supabase.from("deal_professionals").upsert({
      user_id: user.id, opportunity_key: opportunityKey,
      role: String(formData.get("role") ?? "attorney"),
      display_name: displayName,
      organization: String(formData.get("organization") ?? "").trim() || null,
      responsibility: String(formData.get("responsibility") ?? "").trim() || null,
      status: "active", updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,opportunity_key,role,display_name" });
  }
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
}

export async function updateTransitionItem(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  await supabase.from("transition_items").update({
    status: String(formData.get("status") ?? "open"),
    owner: String(formData.get("owner") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", String(formData.get("id") ?? "")).eq("user_id", user.id);
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

export async function addOpportunityNote(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const body = String(formData.get("body") ?? "").trim();
  if (body) {
    await supabase.from("opportunity_notes").insert({
      user_id: user.id,
      opportunity_key: opportunityKey,
      body,
    });
    await supabase.from("deal_activities").insert({
      user_id: user.id,
      opportunity_key: opportunityKey,
      activity_type: "note",
      description: "A private opportunity note was added.",
    });
  }
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
  revalidatePath(`/${locale}/dashboard/lists`);
}

export async function createOpportunityList(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (!isLocale(locale)) redirect("/en/dashboard/lists");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name) {
    await supabase.from("opportunity_lists").upsert({
      user_id: user.id,
      name,
      description: description || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,name" });
  }
  revalidatePath(`/${locale}/dashboard/lists`);
}

export async function addOpportunityToList(formData: FormData) {
  const { locale, opportunityKey, supabase, user } = await authenticatedRequest(formData);
  const listId = String(formData.get("list_id") ?? "");
  if (listId) {
    const { data: list } = await supabase.from("opportunity_lists").select("id").eq("id", listId).eq("user_id", user.id).maybeSingle();
    if (list) {
      await supabase.from("opportunity_list_items").upsert({
        user_id: user.id,
        list_id: list.id,
        opportunity_key: opportunityKey,
      }, { onConflict: "list_id,opportunity_key" });
      await supabase.from("opportunity_lists").update({ updated_at: new Date().toISOString() }).eq("id", list.id).eq("user_id", user.id);
    }
  }
  revalidatePath(`/${locale}/dashboard/opportunities/${opportunityKey}`);
  revalidatePath(`/${locale}/dashboard/lists`);
}
