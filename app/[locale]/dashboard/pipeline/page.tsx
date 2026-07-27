import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { updateDealStage } from "./actions";
import { platformCopy } from "@/lib/platform-copy";

type SavedDeal = {
  id: string;
  opportunity_key: string;
  stage: string;
  next_action: string | null;
};

export default async function PipelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = platformCopy(locale);
  const columns = [
    { key: "saved", title: text.common.saved },
    { key: "screening", title: text.common.screening },
    { key: "evaluating", title: text.common.evaluating },
    { key: "diligence", title: text.common.diligence },
    { key: "negotiation", title: text.common.negotiation },
    { key: "closing", title: text.common.closing },
  ] as const;
  let deals: SavedDeal[] = [];
  let archived: SavedDeal[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("saved_opportunities")
        .select("id, opportunity_key, stage, next_action")
        .eq("user_id", user.id)
        .not("stage", "in", "(complete,passed)")
        .order("updated_at", { ascending: false });
      deals = (data ?? []) as SavedDeal[];
      const { data: archivedData } = await supabase
        .from("saved_opportunities")
        .select("id, opportunity_key, stage, next_action")
        .eq("user_id", user.id)
        .in("stage", ["complete","passed"])
        .order("updated_at", { ascending: false });
      archived = (archivedData ?? []) as SavedDeal[];
    }
  }

  return (
    <PlatformShell locale={locale} active="pipeline">
      <div className="dashboard-content">
        <PageHeading eyebrow={text.pipeline.eyebrow} title={text.pipeline.title} body={text.pipeline.body} />
        {deals.length === 0 ? (
          <div className="empty-state">
            <span>◇</span>
            <h2>{text.pipeline.ready}</h2>
            <p>{text.pipeline.empty}</p>
            <Link className="button button--primary" href={`/${locale}/dashboard/opportunities`}>{text.common.browse}</Link>
          </div>
        ) : (
          <div className="pipeline-board pipeline-board--live">
            {columns.map((column) => {
              const columnDeals = deals.filter((deal) => deal.stage === column.key);
              return (
                <section className="pipeline-column" key={column.key}>
                  <header><strong>{column.title}</strong><span>{columnDeals.length}</span></header>
                  {columnDeals.map((deal) => {
                    const opportunity = getOpportunity(deal.opportunity_key);
                    if (!opportunity) return null;
                    return (
                      <article key={deal.id}>
                        <span>{opportunity.industry}</span>
                        <h2><Link href={`/${locale}/dashboard/opportunities/${opportunity.id}`}>{opportunity.title}</Link></h2>
                        <p>{deal.next_action ?? text.pipeline.next}</p>
                        <form action={updateDealStage}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={deal.id} />
                          <select name="stage" defaultValue={deal.stage} aria-label={`Stage for ${opportunity.title}`}>
                            {columns.map((stage) => <option value={stage.key} key={stage.key}>{stage.title}</option>)}
                            <option value="complete">{text.common.complete}</option>
                            <option value="passed">{text.common.passed}</option>
                          </select>
                          <button type="submit">{text.pipeline.update}</button>
                        </form>
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
        <section className="panel archive-panel">
          <div className="panel__header"><h2>{locale === "es" ? "Archivo de negocios" : "Deal archive"}</h2><span>{archived.length}</span></div>
          {archived.map((deal) => {
            const item = getOpportunity(deal.opportunity_key);
            return item ? <Link className="saved-list-item" href={`/${locale}/dashboard/opportunities/${item.id}`} key={deal.id}><strong>{item.title}</strong><span>{deal.stage} · {item.location} · {item.price}</span></Link> : null;
          })}
          {!archived.length && <p className="muted">{locale === "es" ? "Los negocios completados o descartados aparecerán aquí." : "Completed and passed deals will appear here."}</p>}
        </section>
      </div>
    </PlatformShell>
  );
}
