import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

// Do not redirect to a bearer URL: every open/download must recheck the session
// and current row/storage policies, including revoked and inactive documents.
export async function GET(request: Request, { params }: {
  params: Promise<{ locale: string; id: string; documentId: string }>;
}) {
  const unavailable = () => new Response("Document unavailable. Return to the deal room and check your access.", { status: 404, headers: privateHeaders });
  const { locale, id, documentId } = await params;
  if (!isLocale(locale) || !isSupabaseConfigured()) return unavailable();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return unavailable();
  const { data: inquiry, error: inquiryError } = await supabase.from("deal_inquiries")
    .select("id,broker_id,financial_access_status").eq("id", id).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
  if (inquiryError || !inquiry) return unavailable();
  const { data: document, error } = await supabase.from("deal_room_documents")
    .select("storage_path,mime_type,original_filename,access_level").eq("id", documentId).eq("inquiry_id", id)
    .eq("is_active", true).in("security_status", ["basic_validated", "malware_scanned"]).maybeSingle();
  if (error || !document?.storage_path) return unavailable();
  if (inquiry.broker_id !== user.id) {
    // A pipeline label is not evidence of a signed agreement.
    const { data: nda, error: ndaError } = await supabase.from("deal_ndas")
      .select("id").eq("inquiry_id", id).eq("buyer_id", user.id).eq("status", "signed").maybeSingle();
    if (ndaError || !nda || (document.access_level !== "nda_signed" &&
      !(document.access_level === "approved" && inquiry.financial_access_status === "approved"))) return unavailable();
  }
  const { data: file, error: downloadError } = await supabase.storage.from("deal-files").download(document.storage_path);
  if (downloadError || !file) return unavailable();
  const inline = document.mime_type === "application/pdf" && new URL(request.url).searchParams.get("download") !== "1";
  const filename = String(document.original_filename || document.storage_path.split("/").pop() || "document")
    .replace(/[^a-zA-Z0-9._ -]/g, "_").slice(-160);
  return new Response(file, { headers: {
    ...privateHeaders,
    "Content-Type": inline ? "application/pdf" : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    "Content-Length": String(file.size),
  } });
}
