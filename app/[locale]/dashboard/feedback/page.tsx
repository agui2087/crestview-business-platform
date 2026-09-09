import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { PilotFeedbackForm } from "@/components/pilot-feedback-form";
import { isLocale } from "@/lib/i18n";

export default async function FeedbackPage({ params }: PageProps<"/[locale]/dashboard/feedback">) {
  if (process.env.CRESTVIEW_PILOT_ENABLED !== "true") notFound();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  return <PlatformShell locale={locale} active="feedback"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Piloto privado" : "Private pilot"} title={es ? "Ayúdanos a mejorar Crestview" : "Help us improve Crestview"} body={es ? "Comparte dónde el flujo fue claro, difícil o te impidió continuar. No incluyas información financiera confidencial ni contenido de documentos." : "Tell us where the workflow felt clear, difficult, or blocked you. Do not include confidential financial information or document contents."}/>
    <PilotFeedbackForm locale={locale}/>
  </div></PlatformShell>;
}
