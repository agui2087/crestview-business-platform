"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const listingSchema = z.object({
  title: z.string().trim().min(5).max(140),
  summary: z.string().trim().min(20).max(1200),
  industry: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  state_code: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  asking_price: z.coerce.number().positive().nullable(),
  annual_revenue: z.coerce.number().positive().nullable(),
  cash_flow: z.coerce.number().positive().nullable(),
});

async function context(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (!isLocale(locale)) redirect("/en/sign-in");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return { locale, supabase, user };
}

function optionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(/[$,\s]/g, "");
  return normalized ? Number(normalized) : null;
}

export async function saveMarketplaceRoles(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const roles = ["buyer", "broker", "advisor", "workforce"].filter((role) => formData.get(role) === "on");
  const savedRoles = roles.length ? roles : ["buyer"];
  const primaryRole = savedRoles.includes("broker") ? "broker" : savedRoles.includes("buyer") ? "buyer" : savedRoles.includes("advisor") ? "advisor" : "workforce";
  await supabase.from("profiles").update({
    account_roles: savedRoles,
    primary_role: primaryRole,
    onboarding_completed: true,
  }).eq("user_id", user.id);
  revalidatePath(`/${locale}/dashboard`, "layout");
  redirect(`/${locale}/dashboard/settings?roles=1`);
}

export async function createListing(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    industry: formData.get("industry"),
    city: formData.get("city"),
    state_code: formData.get("state_code"),
    asking_price: optionalNumber(formData.get("asking_price")),
    annual_revenue: optionalNumber(formData.get("annual_revenue")),
    cash_flow: optionalNumber(formData.get("cash_flow")),
  });
  if (!parsed.success) redirect(`/${locale}/dashboard/listings?error=invalid`);
  const { data: listing, error } = await supabase.from("marketplace_listings").insert({
    broker_id: user.id,
    ...parsed.data,
    financing_available: formData.get("financing_available") === "on",
    public_highlights: String(formData.get("public_highlights") ?? "").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8),
    confidential_notes: String(formData.get("confidential_notes") ?? "").trim() || null,
    status: formData.get("publish") === "on" ? "published" : "draft",
  }).select("id").single();
  if (error || !listing) redirect(`/${locale}/dashboard/listings?error=save`);
  const ndaFile = formData.get("nda_file");
  const ndaBody = String(formData.get("nda_template_body") ?? "").trim();
  let ndaStoragePath: string | null = null;
  if (ndaFile instanceof File && ndaFile.size > 0) {
    if (ndaFile.type !== "application/pdf" || ndaFile.size > 10 * 1024 * 1024) {
      redirect(`/${locale}/dashboard/listings?error=nda_file`);
    }
    const safeName = ndaFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    ndaStoragePath = `${user.id}/listing-ndas/${listing.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("deal-files").upload(ndaStoragePath, ndaFile, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) redirect(`/${locale}/dashboard/listings?error=nda_upload`);
  }
  if (ndaBody || ndaStoragePath) {
    const { error: ndaError } = await supabase.from("listing_nda_templates").insert({
      listing_id: listing.id,
      broker_id: user.id,
      document_name: String(formData.get("nda_document_name") ?? "Confidentiality agreement").trim(),
      template_body: ndaBody || "The attached broker-provided confidentiality agreement governs access to non-public information shared for this opportunity.",
      storage_path: ndaStoragePath,
      auto_send: formData.get("auto_send_nda") === "on",
      broker_attested: formData.get("nda_attested") === "on",
    });
    if (ndaError) redirect(`/${locale}/dashboard/listings?error=nda`);
  }
  const qualityScore = Math.min(100,
    30
    + [parsed.data.asking_price, parsed.data.annual_revenue, parsed.data.cash_flow].filter(Boolean).length * 10
    + (String(formData.get("public_highlights") ?? "").trim() ? 10 : 0)
    + (ndaStoragePath ? 20 : 0)
    + (formData.get("financing_available") === "on" ? 5 : 0)
    + (String(formData.get("confidential_notes") ?? "").trim() ? 5 : 0)
  );
  await supabase.from("marketplace_listings").update({ quality_score: qualityScore }).eq("id", listing.id).eq("broker_id", user.id);
  revalidatePath(`/${locale}/dashboard/listings`);
  revalidatePath(`/${locale}/dashboard/marketplace`);
  redirect(`/${locale}/dashboard/listings?created=1`);
}

export async function updateListingStatus(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const status = z.enum(["draft","published","paused","under_offer","sold","withdrawn"]).parse(formData.get("status"));
  const listingId = z.string().uuid().parse(formData.get("listing_id"));
  await supabase.from("marketplace_listings").update({ status, updated_at: new Date().toISOString() }).eq("id", listingId).eq("broker_id", user.id);
  revalidatePath(`/${locale}/dashboard/listings`);
}

export async function createInquiry(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const listingId = String(formData.get("listing_id") ?? "");
  if (listingId.startsWith("demo-")) redirect(`/${locale}/dashboard/inbox?draft=1`);
  const { data: listing } = await supabase.from("marketplace_listings").select("id,title,broker_id").eq("id", listingId).eq("status", "published").maybeSingle();
  if (!listing || listing.broker_id === user.id) redirect(`/${locale}/dashboard/marketplace?error=inquiry`);
  const { data: ndaTemplate } = await supabase.from("listing_nda_templates")
    .select("document_name,template_body,storage_path,version,auto_send,broker_attested")
    .eq("listing_id", listing.id).eq("auto_send", true).eq("broker_attested", true).maybeSingle();
  const { data: existingInquiry } = await supabase.from("deal_inquiries")
    .select("id").eq("listing_id", listing.id).eq("buyer_id", user.id).maybeSingle();
  if (existingInquiry) redirect(`/${locale}/dashboard/deals/${existingInquiry.id}`);
  const message = String(formData.get("message") ?? "").trim();
  const automaticNda = Boolean(ndaTemplate);
  const now = new Date().toISOString();
  const { data: inquiry, error } = await supabase.from("deal_inquiries").upsert({
    listing_id: listing.id,
    buyer_id: user.id,
    broker_id: listing.broker_id,
    subject: `Information request — ${listing.title}`,
    initial_message: message,
    acquisition_experience: String(formData.get("acquisition_experience") ?? ""),
    funding_readiness: String(formData.get("funding_readiness") ?? ""),
    requested_items: ["NDA"],
    status: automaticNda ? "nda_sent" : "submitted",
    updated_at: now,
  }, { onConflict: "listing_id,buyer_id" }).select("id").single();
  if (error || !inquiry) redirect(`/${locale}/dashboard/marketplace?error=inquiry`);
  if (automaticNda && ndaTemplate) {
    const { error: ndaError } = await supabase.from("deal_ndas").upsert({
      inquiry_id: inquiry.id,
      broker_id: listing.broker_id,
      buyer_id: user.id,
      document_name: ndaTemplate.document_name,
      template_body: ndaTemplate.template_body,
      storage_path: ndaTemplate.storage_path,
      template_version: ndaTemplate.version,
      status: "sent",
      sent_at: now,
      signature_record: { source: "listing_template", version: ndaTemplate.version },
    }, { onConflict: "inquiry_id" });
    if (ndaError) redirect(`/${locale}/dashboard/marketplace?error=nda`);
    await supabase.from("deal_status_events").insert({
      inquiry_id: inquiry.id, actor_id: user.id, to_status: "nda_sent",
      note: "The listing NDA was delivered automatically. The broker was not interrupted.",
    });
    revalidatePath(`/${locale}/dashboard/inbox`);
    redirect(`/${locale}/dashboard/deals/${inquiry.id}?nda=ready`);
  }
  await Promise.all([
    supabase.from("deal_messages").insert({ inquiry_id: inquiry.id, sender_id: user.id, recipient_id: listing.broker_id, body: message }),
    supabase.from("marketplace_notifications").insert({
      user_id: listing.broker_id, inquiry_id: inquiry.id, kind: "new_inquiry",
      title: "NDA requested", body: `A buyer requested the NDA for ${listing.title}.`,
      href: `/${locale}/dashboard/inbox?inquiry=${inquiry.id}`,
    }),
    supabase.from("deal_status_events").insert({ inquiry_id: inquiry.id, actor_id: user.id, to_status: "submitted", note: "Buyer requested the listing NDA." }),
  ]);
  revalidatePath(`/${locale}/dashboard/inbox`);
  redirect(`/${locale}/dashboard/inbox?sent=1`);
}

export async function sendMessage(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const body = z.string().trim().min(1).max(5000).parse(formData.get("body"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,broker_id").eq("id", inquiryId).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/inbox?error=forbidden`);
  const recipientId = inquiry.buyer_id === user.id ? inquiry.broker_id : inquiry.buyer_id;
  await Promise.all([
    supabase.from("deal_messages").insert({ inquiry_id: inquiryId, sender_id: user.id, recipient_id: recipientId, body }),
    supabase.from("marketplace_notifications").insert({ user_id: recipientId, inquiry_id: inquiryId, kind: "message", title: "New deal message", body: body.slice(0, 160), href: `/${locale}/dashboard/inbox?inquiry=${inquiryId}` }),
  ]);
  revalidatePath(`/${locale}/dashboard/inbox`);
}

export async function advanceInquiry(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const status = z.enum(["screening","approved","declined","nda_sent","nda_signed","document_review","meeting","offer","closed"]).parse(formData.get("status"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,broker_id,status").eq("id", inquiryId).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/inbox?error=forbidden`);
  await Promise.all([
    supabase.from("deal_inquiries").update({ status, updated_at: new Date().toISOString() }).eq("id", inquiryId),
    supabase.from("deal_status_events").insert({ inquiry_id: inquiryId, actor_id: user.id, from_status: inquiry.status, to_status: status }),
    supabase.from("marketplace_notifications").insert({
      user_id: inquiry.buyer_id === user.id ? inquiry.broker_id : inquiry.buyer_id,
      inquiry_id: inquiryId, kind: "status", title: "Deal status updated",
      body: `The deal moved to ${status.replaceAll("_", " ")}.`, href: `/${locale}/dashboard/deals/${inquiryId}`,
    }),
  ]);
  revalidatePath(`/${locale}/dashboard/inbox`);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
}

export async function sendNda(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,broker_id").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/inbox?error=forbidden`);
  await supabase.from("deal_ndas").upsert({
    inquiry_id: inquiryId, broker_id: user.id, buyer_id: inquiry.buyer_id,
    document_name: String(formData.get("document_name") ?? "Mutual confidentiality agreement"),
    template_body: String(formData.get("template_body") ?? ""), status: "sent", sent_at: new Date().toISOString(),
  }, { onConflict: "inquiry_id" });
  await Promise.all([
    supabase.from("deal_inquiries").update({ status: "nda_sent", updated_at: new Date().toISOString() }).eq("id", inquiryId),
    supabase.from("marketplace_notifications").insert({ user_id: inquiry.buyer_id, inquiry_id: inquiryId, kind: "nda", title: "NDA ready for signature", body: "Review and sign the confidentiality agreement to unlock the deal room.", href: `/${locale}/dashboard/deals/${inquiryId}` }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?nda=sent`);
}

export async function signNda(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const signerName = z.string().trim().min(2).max(100).parse(formData.get("signer_name"));
  const accepted = formData.get("accepted") === "on";
  if (!accepted) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=accept`);
  const now = new Date().toISOString();
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = forwardedFor ? createHash("sha256").update(forwardedFor).digest("hex") : null;
  const { data: currentNda } = await supabase.from("deal_ndas")
    .select("document_name,template_body,storage_path,template_version")
    .eq("inquiry_id", inquiryId).eq("buyer_id", user.id).maybeSingle();
  if (!currentNda) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  const fingerprint = createHash("sha256").update(JSON.stringify({
    name: currentNda.document_name,
    body: currentNda.template_body,
    path: currentNda.storage_path,
    version: currentNda.template_version,
  })).digest("hex");
  const { data: nda } = await supabase.from("deal_ndas").update({
    status: "signed", signed_at: now, signer_name: signerName,
    signer_ip_hash: ipHash,
    document_fingerprint: fingerprint,
    signature_record: {
      accepted: true,
      method: "typed_signature",
      timestamp: now,
      document_version: currentNda.template_version,
      document_fingerprint: fingerprint,
      user_agent: requestHeaders.get("user-agent"),
    },
  }).eq("inquiry_id", inquiryId).eq("buyer_id", user.id).select("broker_id").maybeSingle();
  if (!nda) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  await Promise.all([
    supabase.from("deal_inquiries").update({ status: "nda_signed", updated_at: now }).eq("id", inquiryId),
    supabase.from("marketplace_notifications").insert({ user_id: nda.broker_id, inquiry_id: inquiryId, kind: "nda_signed", title: "NDA signed", body: `${signerName} signed the NDA. The secure deal room is now available.`, href: `/${locale}/dashboard/deals/${inquiryId}` }),
    supabase.from("marketplace_audit_events").insert({ actor_id: user.id, inquiry_id: inquiryId, event_type: "nda_signed", details: { signer_name: signerName, fingerprint } }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?nda=signed`);
}

export async function requestFinancialAccess(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const message = z.string().trim().min(20).max(3000).parse(formData.get("financial_request_message"));
  const timeline = z.string().trim().min(2).max(120).parse(formData.get("financial_request_timeline"));
  const capital = z.string().trim().min(2).max(160).parse(formData.get("financial_request_capital"));
  const requestedItems = formData.getAll("financial_requested_items").map(String).slice(0, 12);
  const { data: inquiry } = await supabase.from("deal_inquiries")
    .select("broker_id,status").eq("id", inquiryId).eq("buyer_id", user.id).maybeSingle();
  if (!inquiry || !["nda_signed","document_review","meeting","offer"].includes(inquiry.status)) {
    redirect(`/${locale}/dashboard/deals/${inquiryId}?error=nda_required`);
  }
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("deal_inquiries").update({
      financial_access_status: "requested",
      financial_request_message: message,
      financial_request_timeline: timeline,
      financial_request_capital: capital,
      financial_requested_at: now,
      requested_items: requestedItems,
      updated_at: now,
    }).eq("id", inquiryId).eq("buyer_id", user.id),
    supabase.from("marketplace_notifications").insert({
      user_id: inquiry.broker_id, inquiry_id: inquiryId, kind: "financial_request",
      title: "Financial access requested",
      body: "A buyer with a signed NDA requested confidential financial information.",
      href: `/${locale}/dashboard/deals/${inquiryId}`,
    }),
    supabase.from("deal_status_events").insert({
      inquiry_id: inquiryId, actor_id: user.id, to_status: inquiry.status,
      note: "Buyer requested broker approval for confidential financial information.",
    }),
    supabase.from("marketplace_audit_events").insert({ actor_id: user.id, inquiry_id: inquiryId, event_type: "financial_access_requested", details: { requested_items: requestedItems, timeline, capital } }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?financial=requested`);
}

export async function decideFinancialAccess(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const decision = z.enum(["more_information","approved","declined"]).parse(formData.get("decision"));
  const { data: inquiry } = await supabase.from("deal_inquiries")
    .select("buyer_id,status").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  const note = decision === "approved"
    ? "Broker approved access to permission-controlled financial documents."
    : decision === "declined"
      ? "Broker declined financial-document access."
      : "Broker requested more information before deciding financial access.";
  const now = new Date().toISOString();
  await Promise.all([
    supabase.from("deal_inquiries").update({
      financial_access_status: decision,
      financial_decided_at: now,
      status: decision === "approved" ? "document_review" : inquiry.status,
      updated_at: now,
    }).eq("id", inquiryId).eq("broker_id", user.id),
    supabase.from("marketplace_notifications").insert({
      user_id: inquiry.buyer_id, inquiry_id: inquiryId, kind: "financial_decision",
      title: decision === "approved" ? "Financial access approved" : decision === "declined" ? "Financial access declined" : "More information requested",
      body: note, href: `/${locale}/dashboard/deals/${inquiryId}`,
    }),
    supabase.from("deal_status_events").insert({
      inquiry_id: inquiryId, actor_id: user.id,
      from_status: inquiry.status, to_status: decision === "approved" ? "document_review" : inquiry.status,
      note,
    }),
    supabase.from("marketplace_audit_events").insert({ actor_id: user.id, inquiry_id: inquiryId, event_type: "financial_access_decided", details: { decision } }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?financial=${decision}`);
}

export async function createDocumentRequest(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const itemName = z.string().trim().min(2).max(120).parse(formData.get("item_name"));
  const note = z.string().trim().max(500).catch("").parse(formData.get("note"));
  const { data: inquiry } = await supabase.from("deal_inquiries")
    .select("broker_id,status").eq("id", inquiryId).eq("buyer_id", user.id).maybeSingle();
  if (!inquiry || !["nda_signed","document_review","meeting","offer","closed"].includes(inquiry.status)) {
    redirect(`/${locale}/dashboard/deals/${inquiryId}?error=nda_required`);
  }
  const { error } = await supabase.from("deal_document_requests").insert({
    inquiry_id: inquiryId,
    requested_by: user.id,
    item_name: itemName,
    note: note || null,
    status: "requested",
    document_id: null,
    resolved_at: null,
  });
  if (error) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=request`);
  await Promise.all([
    supabase.from("marketplace_notifications").insert({
      user_id: inquiry.broker_id, inquiry_id: inquiryId, kind: "document_request",
      title: "Document requested", body: `The buyer requested ${itemName}.`, href: `/${locale}/dashboard/deals/${inquiryId}`,
    }),
    supabase.from("deal_status_events").insert({
      inquiry_id: inquiryId, actor_id: user.id, to_status: inquiry.status,
      note: `Buyer requested: ${itemName}.`,
    }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
}

export async function resolveDocumentRequest(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const requestId = z.string().uuid().parse(formData.get("request_id"));
  const { data: inquiry } = await supabase.from("deal_inquiries")
    .select("buyer_id,status").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  const { data: request } = await supabase.from("deal_document_requests").update({
    status: "not_available", resolved_at: new Date().toISOString(),
  }).eq("id", requestId).eq("inquiry_id", inquiryId).select("item_name").maybeSingle();
  if (!request) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=request`);
  await Promise.all([
    supabase.from("marketplace_notifications").insert({
      user_id: inquiry.buyer_id, inquiry_id: inquiryId, kind: "document_request",
      title: "Document request updated", body: `${request.item_name} was marked unavailable.`, href: `/${locale}/dashboard/deals/${inquiryId}`,
    }),
    supabase.from("deal_status_events").insert({
      inquiry_id: inquiryId, actor_id: user.id, to_status: inquiry.status,
      note: `${request.item_name} was marked unavailable by the broker.`,
    }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
}

export async function addDealRoomDocument(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,status,financial_access_status").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  const title = z.string().trim().min(2).max(160).parse(formData.get("title"));
  const accessLevel = z.enum(["nda_signed","approved","broker_only"]).parse(formData.get("access_level"));
  const category = z.string().trim().min(2).max(80).parse(formData.get("category"));
  const externalUrlRaw = String(formData.get("external_url") ?? "").trim();
  const externalUrl = externalUrlRaw ? z.string().url().parse(externalUrlRaw) : null;
  const requestId = z.string().uuid().nullable().catch(null).parse(formData.get("request_id"));
  const documentFile = formData.get("document_file");
  let storagePath: string | null = null;
  let originalFilename: string | null = null;
  let mimeType: string | null = null;
  let fileSizeBytes: number | null = null;
  if (documentFile instanceof File && documentFile.size > 0) {
    const allowedTypes = new Set([
      "application/pdf", "text/csv", "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (!allowedTypes.has(documentFile.type) || documentFile.size > 20 * 1024 * 1024) {
      redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_file`);
    }
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    storagePath = `${user.id}/deal-rooms/${inquiryId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("deal-files").upload(storagePath, documentFile, {
      contentType: documentFile.type, upsert: false,
    });
    if (uploadError) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_upload`);
    originalFilename = documentFile.name;
    mimeType = documentFile.type;
    fileSizeBytes = documentFile.size;
  }
  if (!storagePath && !externalUrl) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_required`);
  const { data: document, error: documentError } = await supabase.from("deal_room_documents").insert({
      inquiry_id: inquiryId, uploaded_by: user.id, title,
      category,
      storage_path: storagePath,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      external_url: externalUrl,
      access_level: accessLevel,
      permission_note: accessLevel === "approved" ? "Buyer access requires broker approval" : accessLevel === "broker_only" ? "Broker only" : "Available after NDA",
    }).select("id").single();
  if (documentError || !document) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_save`);
  await Promise.all([
    supabase.from("marketplace_audit_events").insert({ actor_id: user.id, inquiry_id: inquiryId, event_type: "document_added", details: { title, category, access_level: accessLevel } }),
    supabase.from("deal_status_events").insert({ inquiry_id: inquiryId, actor_id: user.id, to_status: inquiry.status, note: `${title} was added to the secure deal room.` }),
  ]);
  if (requestId) {
    await supabase.from("deal_document_requests").update({ status: "fulfilled", document_id: document.id, resolved_at: new Date().toISOString() }).eq("id", requestId).eq("inquiry_id", inquiryId);
  }
  if (accessLevel === "nda_signed" || (accessLevel === "approved" && inquiry.financial_access_status === "approved")) {
    await supabase.from("marketplace_notifications").insert({ user_id: inquiry.buyer_id, inquiry_id: inquiryId, kind: "document", title: "New deal-room document", body: `${title} is now available for review.`, href: `/${locale}/dashboard/deals/${inquiryId}` });
  }
  if (category === "Offer / LOI") {
    await Promise.all([
      supabase.from("deal_inquiries").update({ status: "offer", updated_at: new Date().toISOString() }).eq("id", inquiryId).eq("broker_id", user.id),
      supabase.from("deal_status_events").insert({ inquiry_id: inquiryId, actor_id: user.id, to_status: "offer", note: "An offer or LOI was added to the deal room." }),
    ]);
  }
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
}

export async function markNotificationRead(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const notificationId = z.string().uuid().parse(formData.get("notification_id"));
  await supabase.from("marketplace_notifications").update({ read_at: new Date().toISOString() })
    .eq("id", notificationId).eq("user_id", user.id);
  revalidatePath(`/${locale}/dashboard/inbox`);
}

export async function reportMarketplaceItem(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const listingId = z.string().uuid().nullable().catch(null).parse(formData.get("listing_id"));
  const inquiryId = z.string().uuid().nullable().catch(null).parse(formData.get("inquiry_id"));
  const reason = z.enum(["incorrect_information","suspicious_activity","confidentiality","other"]).parse(formData.get("reason"));
  const details = z.string().trim().max(1500).catch("").parse(formData.get("details"));
  await supabase.from("marketplace_reports").insert({
    reporter_id: user.id,
    listing_id: listingId,
    inquiry_id: inquiryId,
    reason,
    details: details || null,
  });
  redirect(`/${locale}/dashboard/inbox?reported=1`);
}
