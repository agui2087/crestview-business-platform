"use server";

import { revalidatePath } from "next/cache";
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
  const roles = ["buyer", "broker"].filter((role) => formData.get(role) === "on");
  await supabase.from("profiles").update({ account_roles: roles.length ? roles : ["buyer"] }).eq("user_id", user.id);
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
  const { error } = await supabase.from("marketplace_listings").insert({
    broker_id: user.id,
    ...parsed.data,
    financing_available: formData.get("financing_available") === "on",
    public_highlights: String(formData.get("public_highlights") ?? "").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8),
    confidential_notes: String(formData.get("confidential_notes") ?? "").trim() || null,
    status: formData.get("publish") === "on" ? "published" : "draft",
  });
  if (error) redirect(`/${locale}/dashboard/listings?error=save`);
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
  const message = String(formData.get("message") ?? "").trim();
  const { data: inquiry, error } = await supabase.from("deal_inquiries").upsert({
    listing_id: listing.id,
    buyer_id: user.id,
    broker_id: listing.broker_id,
    subject: `Information request — ${listing.title}`,
    initial_message: message,
    acquisition_experience: String(formData.get("acquisition_experience") ?? ""),
    funding_readiness: String(formData.get("funding_readiness") ?? ""),
    requested_items: formData.getAll("requested_items").map(String),
    status: "submitted",
    updated_at: new Date().toISOString(),
  }, { onConflict: "listing_id,buyer_id" }).select("id").single();
  if (error || !inquiry) redirect(`/${locale}/dashboard/marketplace?error=inquiry`);
  await Promise.all([
    supabase.from("deal_messages").insert({ inquiry_id: inquiry.id, sender_id: user.id, recipient_id: listing.broker_id, body: message }),
    supabase.from("marketplace_notifications").insert({
      user_id: listing.broker_id, inquiry_id: inquiry.id, kind: "new_inquiry",
      title: "New buyer inquiry", body: `A buyer requested information about ${listing.title}.`,
      href: `/${locale}/dashboard/inbox?inquiry=${inquiry.id}`,
    }),
    supabase.from("deal_status_events").insert({ inquiry_id: inquiry.id, actor_id: user.id, to_status: "submitted", note: "Buyer submitted an information request." }),
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
  const { data: nda } = await supabase.from("deal_ndas").update({
    status: "signed", signed_at: now, signer_name: signerName,
    signature_record: { accepted: true, method: "typed_signature", timestamp: now },
  }).eq("inquiry_id", inquiryId).eq("buyer_id", user.id).select("broker_id").maybeSingle();
  if (!nda) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  await Promise.all([
    supabase.from("deal_inquiries").update({ status: "nda_signed", updated_at: now }).eq("id", inquiryId),
    supabase.from("marketplace_notifications").insert({ user_id: nda.broker_id, inquiry_id: inquiryId, kind: "nda_signed", title: "NDA signed", body: `${signerName} signed the NDA. The secure deal room is now available.`, href: `/${locale}/dashboard/deals/${inquiryId}` }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
  redirect(`/${locale}/dashboard/deals/${inquiryId}?nda=signed`);
}

export async function addDealRoomDocument(formData: FormData) {
  const { locale, supabase, user } = await context(formData);
  const inquiryId = z.string().uuid().parse(formData.get("inquiry_id"));
  const { data: inquiry } = await supabase.from("deal_inquiries").select("buyer_id").eq("id", inquiryId).eq("broker_id", user.id).maybeSingle();
  if (!inquiry) redirect(`/${locale}/dashboard/deals/${inquiryId}?error=forbidden`);
  const title = z.string().trim().min(2).max(160).parse(formData.get("title"));
  await Promise.all([
    supabase.from("deal_room_documents").insert({
      inquiry_id: inquiryId, uploaded_by: user.id, title,
      category: String(formData.get("category") ?? "Other"),
      external_url: String(formData.get("external_url") ?? "").trim() || null,
      access_level: String(formData.get("access_level") ?? "nda_signed"),
    }),
    supabase.from("marketplace_notifications").insert({ user_id: inquiry.buyer_id, inquiry_id: inquiryId, kind: "document", title: "New deal-room document", body: `${title} is now available for review.`, href: `/${locale}/dashboard/deals/${inquiryId}` }),
  ]);
  revalidatePath(`/${locale}/dashboard/deals/${inquiryId}`);
}
