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
  if (!active) redirect(`/${locale}/pricing?billing_error=broker_plan_required`);
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
      auto_send: formData.get("auto_send_nda") === "on",
      broker_attested: ndaAttested,
      security_status: ndaScan ? securityStatusForScan(ndaScan) : "basic_validated",
      scan_provider: ndaScan?.provider ?? "local",
      scan_completed_at: ndaScan ? new Date().toISOString() : null,
      scan_sha256: ndaScan?.sha256 ?? null,
    });
    if (ndaError) {
      if (ndaStoragePath) await supabase.storage.from("deal-files").remove([ndaStoragePath]);
      await supabase.from("marketplace_listings").delete().eq("id", listing.id).eq("broker_id", user.id);
      redirect(`/${locale}/dashboard/listings?error=nda`);
    }
    if (ndaScan) await admin.from("document_security_events").insert({ scope: "listing_nda", document_id: listing.id, actor_id: user.id, status: securityStatusForScan(ndaScan), provider: ndaScan.provider, sha256: ndaScan.sha256 });
  }
  const qualityScore = Math.min(100,
    30
    + [parsed.data.asking_price, parsed.data.annual_revenue, parsed.data.cash_flow].filter(Boolean).length * 10
    + (String(formData.get("public_highlights") ?? "").trim() ? 10 : 0)
    + (ndaStoragePath ? 20 : 0)
    + (formData.get("financing_available") === "on" ? 5 : 0)
    + (String(formData.get("confidential_notes") ?? "").trim() ? 5 : 0)
  );
  await supabase.from("marketplace_listings").update({
    quality_score: qualityScore,
    status: publishing ? "published" : "draft",
    updated_at: new Date().toISOString(),
  }).eq("id", listing.id).eq("broker_id", user.id);
  if (duplicate) {
    await supabase.from("marketplace_notifications").insert({
      user_id: user.id,
      kind: "possible_duplicate_listing",
      title: "Possible duplicate listing",
      body: `“${parsed.data.title}” looks similar to another listing in your account. Please review both listings and remove or pause any duplicate.`,
      href: `/${locale}/dashboard/listings?duplicate=${listing.id}`,
    });
  }
  revalidatePath(`/${locale}/dashboard/listings`);
  revalidatePath(`/${locale}/dashboard/marketplace`);
  redirect(`/${locale}/dashboard/listings?created=1${duplicate ? "&duplicate=1" : ""}`);
}

export async function updateListingStatus(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await requireRole(locale, supabase, user.id, "broker");
  const status = z.enum(["draft","published","paused","under_offer","sold","withdrawn"]).parse(formData.get("status"));
  const listingId = z.string().uuid().parse(formData.get("listing_id"));
  if (ACTIVE_LISTING_STATUSES.includes(status)) {
    await requireActiveBrokerPlan(locale, supabase, user.id);
    const { data: ndaTemplate } = await supabase.from("listing_nda_templates")
      .select("id")
      .eq("listing_id", listingId)
      .eq("broker_id", user.id)
      .eq("auto_send", true)
      .eq("broker_attested", true)
      .in("security_status", ["basic_validated", "malware_scanned"])
      .not("storage_path", "is", null)
      .maybeSingle();
    if (!ndaTemplate) redirect(`/${locale}/dashboard/listings?error=nda_required`);
    const { count } = await supabase.from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("broker_id", user.id)
      .in("status", ACTIVE_LISTING_STATUSES)
      .neq("id", listingId);
    if ((count ?? 0) >= MAX_ACTIVE_BROKER_LISTINGS) redirect(`/${locale}/dashboard/listings?error=limit`);
  }
  const update: Record<string, string> = { status, updated_at: new Date().toISOString() };
  const {data:updated,error}=await supabase.from("marketplace_listings").update(update).eq("id", listingId).eq("broker_id", user.id).select("id").maybeSingle();
  if(error || !updated)redirect(`/${locale}/dashboard/listings?error=save`);
  revalidatePath(`/${locale}/dashboard/listings`);
  redirect(`/${locale}/dashboard/listings?updated=1`);
}

export async function updateDraftListing(formData:FormData) {
  const {locale,supabase,user}=await context(formData);
  await requireRole(locale,supabase,user.id,"broker");
  const id=z.string().uuid().parse(formData.get("listing_id"));
  const parsed=listingSchema.safeParse({title:formData.get("title"),summary:formData.get("summary"),industry:formData.get("industry"),city:formData.get("city"),state_code:formData.get("state_code"),asking_price:optionalNumber(formData.get("asking_price")),annual_revenue:optionalNumber(formData.get("annual_revenue")),cash_flow:optionalNumber(formData.get("cash_flow"))});
  if(!parsed.success)redirect(`/${locale}/dashboard/listings?error=invalid`);
  const {data,error}=await supabase.from("marketplace_listings").update({...parsed.data,updated_at:new Date().toISOString()}).eq("id",id).eq("broker_id",user.id).eq("status","draft").select("id").maybeSingle();
  if(error || !data)redirect(`/${locale}/dashboard/listings?error=draft_changed`);
  revalidatePath(`/${locale}/dashboard/listings`);
  redirect(`/${locale}/dashboard/listings?updated=1`);
}

export async function attachDraftNda(formData:FormData) {
  const {locale,supabase,user}=await context(formData);
  await requireRole(locale,supabase,user.id,"broker");
  const id=z.string().uuid().parse(formData.get("listing_id"));
  const {data:listing}=await supabase.from("marketplace_listings").select("id").eq("id",id).eq("broker_id",user.id).eq("status","draft").maybeSingle();
  if(!listing)redirect(`/${locale}/dashboard/listings?error=draft_changed`);
  const {data:existing,error:lookupError}=await supabase.from("listing_nda_templates").select("id").eq("listing_id",id).maybeSingle();
  // Never replace an existing agreement or invalidate a version already signed.
  if(lookupError || existing)redirect(`/${locale}/dashboard/listings?error=nda_exists`);
  const file=formData.get("nda_file");
  if(formData.get("nda_attested") !== "on" || !(file instanceof File) || !file.size)redirect(`/${locale}/dashboard/listings?error=nda_required`);
  if(file.type !== "application/pdf" || file.size > maxVaultDocumentBytes || !await validateUploadedDocument(file))redirect(`/${locale}/dashboard/listings?error=nda_file`);
  const reservation=await reserveUpload(supabase,user.id,"listing_nda",id,file.size);
  if(!reservation)redirect(`/${locale}/dashboard/listings?error=upload_limit`);
  const scan=await scanUploadedDocument(file);
  if(scan.status !== "clean"){
    await finishUpload(supabase,reservation,"rejected");await reportRejectedScan(user.id,"listing_nda",scan);
    redirect(`/${locale}/dashboard/listings?error=nda_file`);
  }
  const path=`${user.id}/listing-ndas/${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-").slice(-100)}`;
  const {error:uploadError}=await supabase.storage.from("deal-files").upload(path,file,{contentType:"application/pdf",upsert:false});
  if(uploadError){await finishUpload(supabase,reservation,"rejected");redirect(`/${locale}/dashboard/listings?error=nda_upload`);}
  const admin=createSupabaseAdminClient();
  const {error}=await admin.from("listing_nda_templates").insert({listing_id:id,broker_id:user.id,document_name:file.name,template_body:"Review the complete broker-provided PDF before signing. The PDF contains the controlling terms.",storage_path:path,auto_send:true,broker_attested:true,security_status:securityStatusForScan(scan),scan_provider:scan.provider,scan_completed_at:new Date().toISOString(),scan_sha256:scan.sha256});
  if(error){await supabase.storage.from("deal-files").remove([path]);await finishUpload(supabase,reservation,"rejected");redirect(`/${locale}/dashboard/listings?error=nda_upload`);}
  await finishUpload(supabase,reservation,"committed");
  const {error:auditError}=await admin.from("document_security_events").insert({scope:"listing_nda",document_id:id,actor_id:user.id,status:securityStatusForScan(scan),provider:scan.provider,sha256:scan.sha256});
  if(auditError)await reportOperationalEvent({event:"document.security_event_failed",level:"error",error:auditError,details:{scope:"listing_nda"}});
  revalidatePath(`/${locale}/dashboard/listings`);
  redirect(`/${locale}/dashboard/listings?nda_saved=1`);
}

export async function confirmListingAvailability(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await requireRole(locale, supabase, user.id, "broker");
  await requireActiveBrokerPlan(locale, supabase, user.id);
  const listingId = z.string().uuid().parse(formData.get("listing_id"));
  const now = new Date().toISOString();
  await supabase.from("marketplace_listings")
    .update({ updated_at: now })
    .eq("id", listingId)
    .eq("broker_id", user.id)
    .in("status", ACTIVE_LISTING_STATUSES);
  revalidatePath(`/${locale}/dashboard/listings`);
  revalidatePath(`/${locale}/dashboard/marketplace`);
  redirect(`/${locale}/dashboard/listings?confirmed=1`);
}

export async function createInquiry(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await requireRole(locale, supabase, user.id, "buyer");
  const listingId = String(formData.get("listing_id") ?? "");
  if (listingId.startsWith("demo-")) redirect(`/${locale}/dashboard/inbox?draft=1`);
  const { data: listing } = await supabase.from("marketplace_listings").select("id,title,broker_id").eq("id", listingId).eq("status", "published").maybeSingle();
  if (!listing || listing.broker_id === user.id) redirect(`/${locale}/dashboard/marketplace?error=inquiry`);
  const { data: ndaTemplate } = await supabase.from("listing_nda_templates")
    .select("document_name,template_body,storage_path,version,auto_send,broker_attested,security_status")
    .eq("listing_id", listing.id).eq("auto_send", true).eq("broker_attested", true)
    .in("security_status", ["basic_validated", "malware_scanned"]).maybeSingle();
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
  const parsedBody = z.string().trim().min(1).max(5000).safeParse(formData.get("body"));
  if (!parsedBody.success) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=message_invalid`);
  const body = parsedBody.data;
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,broker_id").eq("id", inquiryId).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/inbox?error=forbidden`);
  const recipientId = inquiry.buyer_id === user.id ? inquiry.broker_id : inquiry.buyer_id;
  const { error: messageError } = await supabase.from("deal_messages").insert({ inquiry_id: inquiryId, sender_id: user.id, recipient_id: recipientId, body });
  if (messageError) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=message_failed`);
  const { error: notificationError } = await supabase.from("marketplace_notifications").insert({ user_id: recipientId, inquiry_id: inquiryId, kind: "message", title: "New deal message", body: body.slice(0, 160), href: `/${locale}/dashboard/deals/${inquiryId}` });
  if (notificationError) await reportOperationalEvent({ event: "deal.notification_failed", level: "error", route: "/dashboard/deals/[id]", error: notificationError });
  revalidatePath(`/${locale}/dashboard/inbox`);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?message=sent#deal-conversation`);
}

export async function advanceInquiry(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await requireRole(locale, supabase, user.id, "broker");
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const status = z.enum(dealStatuses).parse(formData.get("status"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,broker_id,status,updated_at").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/inbox?error=forbidden`);
  if (!canBrokerAdvanceDeal(inquiry.status, status)) {
    redirect(`/${locale}/dashboard/deals/${inquiryId}?error=invalid_stage`);
  }
  if (formData.get("expected_updated_at") !== inquiry.updated_at) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=stage_conflict`);
  if (status === "closed" && formData.get("closing_confirmed") !== "on") redirect(`/${locale}/dashboard/deals/${inquiryId}?error=closing_confirmation`);
  const {data: changed, error: changeError} = await supabase.from("deal_inquiries").update({status,updated_at:new Date().toISOString()}).eq("id",inquiryId).eq("broker_id",user.id).eq("updated_at",inquiry.updated_at).select("id").maybeSingle();
  if (changeError || !changed) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=stage_conflict`);
  const followups = await Promise.all([
    supabase.from("deal_status_events").insert({ inquiry_id: inquiryId, actor_id: user.id, from_status: inquiry.status, to_status: status }),
    supabase.from("marketplace_notifications").insert({
      user_id: inquiry.buyer_id === user.id ? inquiry.broker_id : inquiry.buyer_id,
      inquiry_id: inquiryId, kind: "status", title: "Deal status updated",
      body: `The deal moved to ${status.replaceAll("_", " ")}.`, href: `/${locale}/dashboard/deals/${inquiryId}`,
    }),
  ]);
  if (followups.some(result => result.error)) await reportOperationalEvent({event:"deal.status_followup_failed",level:"error",route:"/dashboard/deals/[id]",message:"Stage saved, but activity or notification could not be recorded."});
  revalidatePath(`/${locale}/dashboard/inbox`);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?stage=updated`);
}

export async function sendNda(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await requireRole(locale, supabase, user.id, "broker");
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id,broker_id").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/inbox?error=forbidden`);
  // Never replace an agreement that has already been sent or signed.
  const { error: ndaError } = await supabase.from("deal_ndas").insert({
    inquiry_id: inquiryId, broker_id: user.id, buyer_id: inquiry.buyer_id,
    document_name: String(formData.get("document_name") ?? "Mutual confidentiality agreement"),
    template_body: String(formData.get("template_body") ?? ""), status: "sent", sent_at: new Date().toISOString(),
  });
  if (ndaError) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=nda_send`);
  const [stageUpdate] = await Promise.all([
    supabase.from("deal_inquiries").update({ status: "nda_sent", updated_at: new Date().toISOString() }).eq("id", inquiryId),
    supabase.from("marketplace_notifications").insert({ user_id: inquiry.buyer_id, inquiry_id: inquiryId, kind: "nda", title: "NDA ready for signature", body: "Review and sign the confidentiality agreement to unlock the deal room.", href: `/${locale}/dashboard/deals/${inquiryId}` }),
  ]);
  if (stageUpdate.error) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=stage_update`);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?nda=sent`);
}

export async function signNda(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await requireRole(locale, supabase, user.id, "buyer");
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
  const [inquiryUpdate] = await Promise.all([
    supabase.from("deal_inquiries").update({ status: "nda_signed", updated_at: now }).eq("id", inquiryId).select("id").maybeSingle(),
    supabase.from("marketplace_notifications").insert({ user_id: nda.broker_id, inquiry_id: inquiryId, kind: "nda_signed", title: "NDA signed", body: `${signerName} signed the NDA. The secure deal room is now available.`, href: `/${locale}/dashboard/deals/${inquiryId}` }),
    supabase.from("marketplace_audit_events").insert({ actor_id: user.id, inquiry_id: inquiryId, event_type: "nda_signed", details: { signer_name: signerName, fingerprint } }),
  ]);
  if (inquiryUpdate.error || !inquiryUpdate.data) {
    redirect(`/${locale}/dashboard/deals/${inquiryId}?error=stage_update`);
  }
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?nda=signed`);
}

async function finishFinancialChange(locale: string, inquiryId: string, decision: string, result: Awaited<ReturnType<typeof runFinancialAccessChange>>) {
  if (!result.ok) {
    if (result.reason === "unavailable") {
      await reportOperationalEvent({ event: "deal.financial_access_failed", level: "error", route: "/dashboard/deals/[id]", message: "Financial access transaction could not be confirmed." });
    }
    revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
    redirect(`/${locale}/dashboard/deals/${inquiryId}?error=financial_${result.reason}`);
  }
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?financial=${decision}`);
}

function financialVersion(formData: FormData, locale: string, inquiryId: string) {
  const parsed = z.string().datetime({ offset: true }).safeParse(formData.get("expected_updated_at"));
  if (!parsed.success) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=financial_conflict`);
  return parsed.data;
}

export async function requestFinancialAccess(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  await requireRole(locale, supabase, user.id, "buyer");
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const version = financialVersion(formData, locale, inquiryId);
  const details = z.object({
    message: z.string().trim().min(20).max(3000),
    timeline: z.string().trim().min(2).max(120),
    capital: z.string().trim().min(2).max(160),
    items: z.array(z.string().max(200)).max(12),
  }).safeParse({
    message: formData.get("financial_request_message"),
    timeline: formData.get("financial_request_timeline"),
    capital: formData.get("financial_request_capital"),
    items: formData.getAll("financial_requested_items"),
  });
  if (!details.success) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=financial_invalid`);
  const { message, timeline, capital, items } = details.data;
  const result = await runFinancialAccessChange(() => supabase.rpc("change_deal_financial_access", {
    target_inquiry: inquiryId, action: "requested", expected_updated_at: version,
    request_message: message, request_timeline: timeline, request_capital: capital,
    request_items: items, locale,
  }));
  await finishFinancialChange(locale, inquiryId, "requested", result);
}

export async function decideFinancialAccess(formData: FormData) {
  const { locale, supabase } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
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
