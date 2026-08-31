import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { DocumentManager } from "@/components/document-manager";
import { isLocale } from "@/lib/i18n";

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const es = locale === "es";
  return <PlatformShell locale={locale} active="documents"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Bóveda de documentos" : "Document vault"} title={es ? "Documentos de diligencia" : "Due-diligence documents"} body={es ? "Carga, organiza y controla los documentos privados de cada adquisición en un solo lugar." : "Upload, organize, and control private documents for each acquisition in one place."} />
    <DocumentManager locale={locale} />
  </div></PlatformShell>;
}
