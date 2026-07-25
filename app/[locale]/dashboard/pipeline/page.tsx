import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { pipelineColumns } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

export default async function PipelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <PlatformShell locale={locale} active="pipeline"><div className="dashboard-content">
    <PageHeading eyebrow="Deal management" title="Acquisition pipeline" body="See where every opportunity stands and what should happen next." />
    <div className="pipeline-board">{pipelineColumns.map((column) => <section className="pipeline-column" key={column.title}><header><strong>{column.title}</strong><span>{column.count}</span></header>{column.deals.map((deal) => <article key={deal}><span>Sample deal</span><h2>{deal}</h2><p>Next action needs review</p></article>)}</section>)}</div>
  </div></PlatformShell>;
}
