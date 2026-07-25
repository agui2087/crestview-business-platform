import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <PlatformShell locale={locale} active="documents"><div className="dashboard-content">
    <PageHeading eyebrow="Secure workspace" title="Documents" body="Organize deal files while keeping source documents separate from AI analysis." action={<button className="button button--primary" disabled>Upload document</button>} />
    <div className="empty-state"><span>▣</span><h2>Document storage is ready for connection</h2><p>Private uploads will become available when Supabase Storage is connected. Files will be scanned and access controlled by organization.</p></div>
  </div></PlatformShell>;
}
