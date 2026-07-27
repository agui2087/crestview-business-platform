import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getOpportunity } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { updateDealStage } from "./actions";

const columns = [
  { key: "saved", title: "Saved" },
  { key: "screening", title: "Screening" },
  { key: "evaluating", title: "Evaluating" },
  { key: "diligence", title: "Due diligence" },
  { key: "negotiation", title: "Negotiation" },
  { key: "closing", title: "Closing" },
] as const;

type SavedDeal = {
  id: string;
  opportunity_key: string;
  stage: string;
  next_action: string | null;
};

export default async function PipelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let deals: SavedDeal[] = [];
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
    }
  }

  return (
    <PlatformShell locale={locale} active="pipeline">
      <div className="dashboard-content">
        <PageHeading eyebrow="Deal management" title="Acquisition pipeline" body="Your saved opportunities, current stages, and next actions are stored securely with your account." />
        {deals.length === 0 ? (
          <div className="empty-state">
            <span>◇</span>
            <h2>Your pipeline is ready</h2>
            <p>Save an opportunity or select “Begin acquisition” to add your first real deal.</p>
            <Link className="button button--primary" href={`/${locale}/dashboard/opportunities`}>Browse opportunities</Link>
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
                        <p>{deal.next_action ?? "Choose the next action for this deal."}</p>
                        <form action={updateDealStage}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={deal.id} />
                          <select name="stage" defaultValue={deal.stage} aria-label={`Stage for ${opportunity.title}`}>
                            {columns.map((stage) => <option value={stage.key} key={stage.key}>{stage.title}</option>)}
                            <option value="complete">Complete</option>
                            <option value="passed">Passed</option>
                          </select>
                          <button type="submit">Update</button>
                        </form>
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
