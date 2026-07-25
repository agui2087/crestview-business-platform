import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

export default async function OpportunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const storageReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return (
    <PlatformShell locale={locale} active="opportunities">
      <div className="dashboard-content">
        <PageHeading eyebrow="DealFlow" title="Businesses for sale" body="Search, screen, and save acquisition opportunities in one place." action={<button className="button button--primary" disabled={!storageReady}>{storageReady ? "Add opportunity" : "Connect database to add"}</button>} />
        <div className="data-notice"><strong>Sample opportunity records</strong><span>A licensed live listing source has not been connected yet, so these records are clearly labeled and are not presented as active listings.</span></div>
        <div className="opportunity-toolbar">
          <input aria-label="Search opportunities" placeholder="Search by business, industry, or location" />
          <button type="button">Industry ▾</button><button type="button">Location ▾</button><button type="button">Price ▾</button>
        </div>
        <div className="opportunity-list">
          {opportunities.map((item) => (
            <article className="opportunity-row" key={item.id}>
              <div className="opportunity-row__main">
                <span className="source-label">{item.source}</span>
                <h2>{item.name}</h2><p>{item.industry} · {item.location}</p>
              </div>
              <div><span>Asking price</span><strong>{item.price}</strong></div>
              <div><span>Revenue</span><strong>{item.revenue}</strong></div>
              <div><span>Cash flow</span><strong>{item.cashFlow}</strong></div>
              <div className="compact-score"><strong>{item.score}</strong><span>AI readiness</span></div>
              <button className="save-button" type="button" disabled={!storageReady} aria-label={`Save ${item.name}`}>{storageReady ? "Save" : "Save soon"}</button>
            </article>
          ))}
        </div>
      </div>
    </PlatformShell>
  );
}
