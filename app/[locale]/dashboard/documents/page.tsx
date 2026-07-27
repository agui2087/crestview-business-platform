import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { DocumentManager } from "@/components/document-manager";
import { isLocale } from "@/lib/i18n";

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const es = locale === "es";
  return <PlatformShell locale={locale} active="documents"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Espacio seguro" : "Secure workspace"} title={es ? "Documentos" : "Documents"} body={es ? "Sube y organiza archivos manteniendo los documentos fuente separados del análisis de IA." : "Upload and organize deal files while keeping source documents separate from AI analysis."} />
    <DocumentManager locale={locale} />
  </div></PlatformShell>;
}
