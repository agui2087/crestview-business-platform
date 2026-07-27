import Link from "next/link";
import { notFound } from "next/navigation";
import { AcquisitionPlanner } from "@/components/acquisition-planner";
import { PlatformShell } from "@/components/platform-shell";
import { getOpportunity, opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { beginAcquisition, saveOpportunity } from "../actions";

export function generateStaticParams() {
  return opportunities.flatMap((item) => ["en", "es"].map((locale) => ({ locale, id: item.id })));
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const opportunity = getOpportunity(id);
  if (!opportunity) notFound();
  let savedStage: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("saved_opportunities")
        .select("stage")
        .eq("user_id", user.id)
        .eq("opportunity_key", opportunity.id)
        .maybeSingle();
      savedStage = data?.stage ?? null;
    }
  }

  return (
    <PlatformShell locale={locale} active="opportunities">
      <div className="dashboard-content">
        <Link className="back-link" href={`/${locale}/dashboard/opportunities`}>← All opportunities</Link>
        <div className="detail-heading">
          <div><span>{opportunity.source} · {opportunity.sourceId}</span><h1>{opportunity.title}</h1><p>{opportunity.industry} · {opportunity.location}</p></div>
          <div className="detail-actions">
            <form action={saveOpportunity}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="opportunity_key" value={opportunity.id} />
              <button className="button button--light" type="submit">{savedStage ? "Saved ✓" : "Save opportunity"}</button>
            </form>
            <form action={beginAcquisition}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="opportunity_key" value={opportunity.id} />
              <button className="button button--primary" type="submit">{savedStage && savedStage !== "saved" ? "Open in pipeline" : "Begin acquisition"}</button>
            </form>
            <a className="button button--light" href={opportunity.sourceUrl} target="_blank" rel="noreferrer">View source listing ↗</a>
          </div>
        </div>
        <div className="source-warning">Seller or broker reported information. Crestview has not independently verified the listing. Last checked {opportunity.lastChecked}.</div>
        <div className="detail-metrics">
          {[["Asking price",opportunity.price],["Revenue",opportunity.revenue],["Cash flow / SDE",opportunity.cashFlow],["EBITDA",opportunity.ebitda]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="detail-grid">
          <article className="detail-card"><h2>Listing summary</h2><p>{opportunity.description}</p><h3>Public highlights</h3><ul>{opportunity.highlights.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article className="detail-card detail-card--missing"><h2>Information to request</h2><p>These items were not found in the public listing and should not be assumed.</p><ul>{opportunity.missing.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
        <article className="broker-card">
          <div><span>Broker or listing contact</span><h2>{opportunity.brokerName ?? "Contact through the source listing"}</h2><p>Use the original listing when a direct contact was not published. Confirm availability before relying on any figures.</p></div>
          <div className="broker-contact">
            {opportunity.brokerPhone && <a href={`tel:${opportunity.brokerPhone}`}>{opportunity.brokerPhone}</a>}
            {opportunity.brokerEmail && <a href={`mailto:${opportunity.brokerEmail}`}>{opportunity.brokerEmail}</a>}
            <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">Contact through listing ↗</a>
          </div>
        </article>
        <AcquisitionPlanner opportunity={opportunity} />
      </div>
    </PlatformShell>
  );
}
