"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canBrokerAdvanceDeal, dealStatuses } from "@/lib/deal-workflow-policy";
import { maxDealRoomDocumentBytes, maxVaultDocumentBytes, scanUploadedDocument, securityStatusForScan, validateUploadedDocument } from "@/lib/document-security";
import { logOperationalEvent, reportOperationalEvent } from "@/lib/observability";
import { runFinancialAccessChange } from "@/lib/financial-access-result";

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

const MAX_ACTIVE_BROKER_LISTINGS = 100;
const ACTIVE_LISTING_STATUSES = ["published", "under_offer"];

function normalizedListingText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function context(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (!isLocale(locale)) redirect("/en/sign-in");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);
  return { locale, supabase, user };
}

async function reserveUpload(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  scope: "deal_room" | "listing_nda",
  resourceId: string | null,
  sizeBytes: number,
) {
  const { data, error } = await supabase.rpc("reserve_document_upload", {
    p_user_id: userId, p_scope: scope, p_resource_id: resourceId, p_size_bytes: sizeBytes,
  });
  if (error || !data) return null;
  return String(data);
}

async function finishUpload(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  reservationId: string,
  status: "committed" | "rejected",
) {
  await supabase.rpc("finish_document_upload", { p_reservation_id: reservationId, p_status: status });
}

async function reportRejectedScan(
  userId: string,
  scope: "deal_room" | "listing_nda",
  scan: Awaited<ReturnType<typeof scanUploadedDocument>>,
) {
  const status = scan.status === "blocked" ? "blocked" : "scan_error";
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("document_security_events").insert({
    scope,
    document_id: null,
    actor_id: userId,
    status,
    provider: scan.provider,
    sha256: scan.sha256,
    details: scan.reason ? { reason: scan.reason } : {},
  });
  if (error) await reportOperationalEvent({ event: "document.security_event_failed", level: "error", error, details: { scope, status } });
  if (scan.status === "unavailable") {
    await reportOperationalEvent({ event: "document.scan_unavailable", level: "error", message: scan.reason ?? undefined, details: { scope, provider: scan.provider, sha256: scan.sha256 } });
  } else {
    logOperationalEvent({ event: "document.scan_blocked", level: "warn", details: { scope, provider: scan.provider, sha256: scan.sha256 } });
  }
}

async function requireRole(
  locale: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  role: "buyer" | "broker",
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_roles")
    .eq("user_id", userId)
    .maybeSingle();
  const roles = (profile?.account_roles as string[] | null) ?? [];
  if (!roles.includes(role)) redirect(`/${locale}/dashboard/settings?error=${role}_role_required`);
}

async function requireActiveBrokerPlan(
  locale: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  listingId?: string,
) {
  const { data: entitlement } = await supabase
    .from("billing_entitlements")
    .select("active,expires_at")
    .eq("user_id", userId)
    .eq("product_code", "broker_plan")
    .maybeSingle();
  const active = Boolean(
    entitlement?.active &&
      (!entitlement.expires_at || new Date(entitlement.expires_at) > new Date()),
  );
  if(!active && listingId && process.env.CRESTVIEW_LISTING_PRODUCTS_ENABLED==='true'){
    const {data:license,error}=await supabase.from('listing_product_orders').select('id').eq('user_id',userId).eq('listing_id',listingId)
      .eq('product_code','single_listing').eq('status','paid').is('ends_at',null).maybeSingle();
    if(error)throw error;
    if(license)return;
  }
  if (!active) redirect(listingId && process.env.CRESTVIEW_LISTING_PRODUCTS_ENABLED==='true'?`/${locale}/dashboard/listings?purchase=access_required#listing-purchases`:`/${locale}/pricing?billing_error=broker_plan_required`);
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
  await requireRole(locale, supabase, user.id, "broker");
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
  const publishing = formData.get("listing_action") === "publish" || formData.get("publish") === "on";
  if (publishing) await requireActiveBrokerPlan(locale, supabase, user.id);
  const ndaFile = formData.get("nda_file");
  const ndaAttested = formData.get("nda_attested") === "on";
  let ndaScan: Awaited<ReturnType<typeof scanUploadedDocument>> | null = null;
  if (publishing && (!(ndaFile instanceof File) || ndaFile.size === 0 || !ndaAttested)) {
    redirect(`/${locale}/dashboard/listings?new=1&error=nda_required#new-listing`);
  }
  if (ndaFile instanceof File && ndaFile.size > 0) {
    if (
      ndaFile.type !== "application/pdf" ||
      ndaFile.size > maxVaultDocumentBytes ||
      !(await validateUploadedDocument(ndaFile))
    ) {
      redirect(`/${locale}/dashboard/listings?new=1&error=nda_file#new-listing`);
    }
    ndaScan = await scanUploadedDocument(ndaFile);
    if (ndaScan.status !== "clean") {
      await reportRejectedScan(user.id, "listing_nda", ndaScan);
      redirect(`/${locale}/dashboard/listings?new=1&error=nda_file#new-listing`);
    }
  }
  if (publishing) {
    const { count } = await supabase.from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("broker_id", user.id)
      .in("status", ACTIVE_LISTING_STATUSES);
    if ((count ?? 0) >= MAX_ACTIVE_BROKER_LISTINGS) redirect(`/${locale}/dashboard/listings?error=limit`);
  }

  const { data: possibleDuplicates } = await supabase.from("marketplace_listings")
    .select("id,title,city,state_code,asking_price")
    .eq("broker_id", user.id)
    .in("status", ["draft", "published", "paused", "under_offer"])
    .ilike("city", parsed.data.city)
    .eq("state_code", parsed.data.state_code)
    .limit(20);
  const duplicate = possibleDuplicates?.find((candidate) => {
    const sameTitle = normalizedListingText(candidate.title) === normalizedListingText(parsed.data.title);
    const samePrice = parsed.data.asking_price && candidate.asking_price
      ? Number(candidate.asking_price) === Number(parsed.data.asking_price)
      : false;
    return sameTitle || samePrice;
  });
  const now = new Date().toISOString();
  const { data: listing, error } = await supabase.from("marketplace_listings").insert({
    broker_id: user.id,
    ...parsed.data,
    financing_available: formData.get("financing_available") === "on",
    public_highlights: String(formData.get("public_highlights") ?? "").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8),
    confidential_notes: String(formData.get("confidential_notes") ?? "").trim() || null,
    // Keep the row private until the NDA upload and template record both succeed.
    status: "draft",
    updated_at: now,
  }).select("id").single();
  if (error || !listing) redirect(`/${locale}/dashboard/listings?error=save`);
  const ndaBody = String(formData.get("nda_template_body") ?? "").trim();
  let ndaStoragePath: string | null = null;
  if (ndaFile instanceof File && ndaFile.size > 0) {
    const reservationId = await reserveUpload(supabase, user.id, "listing_nda", listing.id, ndaFile.size);
    if (!reservationId) {
      await supabase.from("marketplace_listings").delete().eq("id", listing.id).eq("broker_id", user.id);
      redirect(`/${locale}/dashboard/listings?error=upload_limit`);
    }
    const safeName = ndaFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    ndaStoragePath = `${user.id}/listing-ndas/${listing.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("deal-files").upload(ndaStoragePath, ndaFile, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) {
      await finishUpload(supabase, reservationId, "rejected");
      await supabase.from("marketplace_listings").delete().eq("id", listing.id).eq("broker_id", user.id);
      redirect(`/${locale}/dashboard/listings?error=nda_upload`);
    }
    await finishUpload(supabase, reservationId, "committed");
  }
  if (ndaBody || ndaStoragePath) {
    const admin = createSupabaseAdminClient();
    const { error: ndaError } = await admin.from("listing_nda_templates").insert({
      listing_id: listing.id,
      broker_id: user.id,
      document_name: String(formData.get("nda_document_name") ?? "Confidentiality agreement").trim(),
      template_body: ndaBody || "The attached broker-provided confidentiality agreement governs access to non-public information shared for this opportunity.",
      storage_path: ndaStoragePath,
      auto_send: formData.get("auto_send_nda…6206 tokens truncated…ta.get("inquiry_id"));
  const version = financialVersion(formData, locale, inquiryId);
  const decision = z.enum(["more_information", "approved", "declined"]).parse(formData.get("decision"));
  // The invoker RPC authenticates the broker and checks the signed NDA under
  // the existing RLS policies. Never fall back to non-transactional writes.
  const result = await runFinancialAccessChange(() => supabase.rpc("change_deal_financial_access", {
    target_inquiry: inquiryId, action: decision, expected_updated_at: version, locale,
  }));
  await finishFinancialChange(locale, inquiryId, decision, result);
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
  await requireRole(locale, supabase, user.id, "broker");
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,status,financial_access_status").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  const title = z.string().trim().min(2).max(160).parse(formData.get("title"));
  const accessLevel = z.enum(["nda_signed","approved","broker_only"]).parse(formData.get("access_level"));
  const category = z.string().trim().min(2).max(80).parse(formData.get("category"));
  const externalUrlRaw = String(formData.get("external_url") ?? "").trim();
  const externalUrl = externalUrlRaw
    ? z.string().url().refine((value) => new URL(value).protocol === "https:").parse(externalUrlRaw)
    : null;
  const requestId = z.string().uuid().nullable().catch(null).parse(formData.get("request_id"));
  const documentFile = formData.get("document_file");
  let storagePath: string | null = null;
  let originalFilename: string | null = null;
  let mimeType: string | null = null;
  let fileSizeBytes: number | null = null;
  let documentScan: Awaited<ReturnType<typeof scanUploadedDocument>> | null = null;
  if (documentFile instanceof File && documentFile.size > 0) {
    const allowedTypes = new Set([
      "application/pdf", "text/csv", "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (
      !allowedTypes.has(documentFile.type) ||
      documentFile.size > maxDealRoomDocumentBytes ||
      !(await validateUploadedDocument(documentFile))
    ) {
      redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_file`);
    }
    documentScan = await scanUploadedDocument(documentFile);
    if (documentScan.status !== "clean") {
      await reportRejectedScan(user.id, "deal_room", documentScan);
      redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_file`);
    }
    const reservationId = await reserveUpload(supabase, user.id, "deal_room", inquiryId, documentFile.size);
    if (!reservationId) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=upload_limit`);
    const safeName = documentFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    storagePath = `${user.id}/deal-rooms/${inquiryId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("deal-files").upload(storagePath, documentFile, {
      contentType: documentFile.type, upsert: false,
    });
    if (uploadError) {
      await finishUpload(supabase, reservationId, "rejected");
      redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_upload`);
    }
    await finishUpload(supabase, reservationId, "committed");
    originalFilename = documentFile.name;
    mimeType = documentFile.type;
    fileSizeBytes = documentFile.size;
  }
  if (!storagePath && !externalUrl) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_required`);
  const admin = createSupabaseAdminClient();
  const { data: document, error: documentError } = await admin.from("deal_room_documents").insert({
      inquiry_id: inquiryId, uploaded_by: user.id, title,
      category,
      storage_path: storagePath,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
      external_url: externalUrl,
      access_level: accessLevel,
      permission_note: accessLevel === "approved" ? "Buyer access requires broker approval" : accessLevel === "broker_only" ? "Broker only" : "Available after NDA",
      security_status: documentScan ? securityStatusForScan(documentScan) : "basic_validated",
      scan_provider: documentScan?.provider ?? "external_link",
      scan_completed_at: documentScan ? new Date().toISOString() : null,
      scan_sha256: documentScan?.sha256 ?? null,
    }).select("id").single();
  if (documentError || !document) {
    if (storagePath) await supabase.storage.from("deal-files").remove([storagePath]);
    redirect(`/${locale}/dashboard/deals/${inquiryId}?error=document_save`);
  }
  if (documentScan) await admin.from("document_security_events").insert({ scope: "deal_room", document_id: document.id, actor_id: user.id, status: securityStatusForScan(documentScan), provider: documentScan.provider, sha256: documentScan.sha256 });
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
