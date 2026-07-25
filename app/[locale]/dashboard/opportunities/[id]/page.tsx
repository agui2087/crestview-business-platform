import Link from "next/link";
import { notFound } from "next/navigation";
import { AcquisitionPlanner } from "@/components/acquisition-planner";
import { PlatformShell } from "@/components/platform-shell";
import { getOpportunity, opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return opportunities.flatMap((item) => ["en", "es"].map((locale) => ({ locale, id: item.id })));
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const opportunity = getOpportunity(id);
  if (!opportunity) notFound();

  return (
    <PlatformShell locale={locale} active="opportunities">
      <div className="dashboard-content">
        <Link className="back-link" href={`/${locale}/dashboard/opportunities`}>← All opportunities</Link>
        <div className="detail-heading">
          <div><span>{opportunity.source} · {opportunity.sourceId}</span><h1>{opportunity.title}</h1><p>{opportunity.industry} · {opportunity.location}</p></div>
          <a className="button button--light" href={opportunity.sourceUrl} target="_blank" rel="noreferrer">View source listing ↗</a>
        </div>
        <div className="source-warning">Seller or broker reported information. Crestview has not independently verified the listing. Last checked {opportunity.lastChecked}.</div>
        <div className="detail-metrics">
          {[["Asking price",opportunity.price],["Revenue",opportunity.revenue],["Cash flow / SDE",opportunity.cashFlow],["EBITDA",opportunity.ebitda]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="detail-grid">
          <article className="detail-card"><h2>Listing summary</h2><p>{opportunity.description}</p><h3>Public highlights</h3><ul>{opportunity.highlights.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className="detail-card detail-card--missing"><h2>Information to request</h2><p>These items were not found in the public listing and should not be assumed.</p><ul>{opportunity.missing.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
        <AcquisitionPlanner opportunity={opportunity} />
      </div>
    </PlatformShell>
  );
}
