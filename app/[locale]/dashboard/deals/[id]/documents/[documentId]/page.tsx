import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { SecurePdfViewer } from "@/components/secure-pdf-viewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure PDF viewer", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function DocumentPage({ params }: { params: Promise<{ locale: string; id: string; documentId: string }> }) {
  const { locale, id, documentId } = await params;
  if (!isLocale(locale) || !isSupabaseConfigured()) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) notFound();
  const { data: inquiry, error: inquiryError } = await supabase.from("deal_inquiries").select("id").eq("id",id).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
  if (inquiryError || !inquiry) notFound();
  // The session-bound client preserves RLS approval/NDA restrictions. Never use an admin client here.
  const { data: document, error } = await supabase.from("deal_room_documents").select("title,storage_path,mime_type").eq("id",documentId).eq("inquiry_id",id).eq("is_active",true).in("security_status",["basic_validated","malware_scanned"]).maybeSingle();
  if (error || !document?.storage_path || document.mime_type !== "application/pdf") notFound();
  const source = `/${locale}/dashboard/deals/${id}/documents/${documentId}/file`;
  const back = `/${locale}/dashboard/deals/${id}#deal-documents`;
  return <main style={{padding:"clamp(16px,4vw,48px)"}}><a href={back}>{locale === "es" ? "Volver a los documentos" : "Back to secure documents"}</a><h1>{document.title}</h1><SecurePdfViewer source={source} download={`${source}?download=1`} title={document.title} locale={locale} sessionChecked/></main>;
}
