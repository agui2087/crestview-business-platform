import Link from "next/link";
import { notFound } from "next/navigation";
import { AcquisitionPlanner } from "@/components/acquisition-planner";
import { PlatformShell } from "@/components/platform-shell";
import { getOpportunity, opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { addBrokerInteraction, addDiligenceItem, beginAcquisition, saveOpportunity, updateDiligenceItem } from "../actions";

export function generateStaticParams() {
  return opportunities.flatMap((item) => ["en", "es"].map((locale) => ({ locale, id: item.id })));
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const opportunity = getOpportunity(id);
  if (!opportunity) notFound();
  let workspace: {
    stage: string;
    current_step: number;
    checklist_progress: Record<string, string>;
    step_notes: Record<string, string>;
    valuation_inputs: Record<string, string>;
  } | null = null;
  let diligence: Array<{ id: string; category: string; title: string; status: string; due_date: string | null }> = [];
  let interactions: Array<{ id: string; interaction_type: string; summary: string; contact_name: string | null; occurred_at: string }> = [];
  let activities: Array<{ id: string; description: string; created_at: string }> = [];
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("saved_opportunities")
        .select("stage, current_step, checklist_progress, step_notes, valuation_inputs")
        .eq("user_id", user.id)
        .eq("opportunity_key", opportunity.id)
        .maybeSingle();
      workspace = data ?? null;
      const [{ data: diligenceData }, { data: interactionData }, { data: activityData }] = await Promise.all([
        supabase.from("diligence_items").select("id,category,title,status,due_date").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("category"),
        supabase.from("broker_interactions").select("id,interaction_type,summary,contact_name,occurred_at").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("occurred_at", { ascending: false }).limit(10),
        supabase.from("deal_activities").select("id,description,created_at").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("created_at", { ascending: false }).limit(12),
      ]);
      diligence = diligenceData ?? [];
      interactions = interactionData ?? [];
      activities = activityData ?? [];
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
              <button className="button button--light" type="submit">{workspace ? "Saved ✓" : "Save opportunity"}</button>
            </form>
            <form action={beginAcquisition}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="opportunity_key" value={opportunity.id} />
              <button className="button button--primary" type="submit">{workspace && workspace.stage !== "saved" ? "Open in pipeline" : "Begin acquisition"}</button>
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
        <section className="listing-quality">
          <div><span>Listing freshness</span><strong>Recently checked</strong><p>Last reviewed {opportunity.lastChecked}. Confirm availability with the source.</p></div>
          <div><span>Data completeness</span><strong>{Math.round(([opportunity.priceValue, opportunity.revenueValue, opportunity.cashFlowValue, opportunity.ebitdaValue, opportunity.brokerEmail ?? opportunity.brokerPhone].filter(Boolean).length / 5) * 100)}%</strong><p>{opportunity.missing.length} important information requests identified.</p></div>
          <div><span>Duplicate review</span><strong>No duplicate detected</strong><p>Compared by source and listing identifier in the current Crestview catalog.</p></div>
        </section>
        <AcquisitionPlanner opportunity={opportunity} initialWorkspace={workspace} locale={locale} />
        {workspace && workspace.stage !== "saved" && <div className="deal-operations">
          <section className="operations-card">
            <header><div><span>Due diligence</span><h2>Verification tracker</h2></div><strong>{diligence.filter((item)=>item.status === "verified").length}/{diligence.length} verified</strong></header>
            <form className="inline-create" action={addDiligenceItem}>
              <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/>
              <select name="category"><option>Financial</option><option>Legal</option><option>Operational</option><option>Customer</option><option>Employee</option><option>Compliance</option></select>
              <input name="title" required placeholder="Item to verify"/>
              <input name="due_date" type="date"/>
              <button type="submit">Add</button>
            </form>
            {diligence.map((item)=><article className="diligence-row" key={item.id}><div><span>{item.category}</span><strong>{item.title}</strong><small>{item.due_date ?? "No due date"}</small></div><form action={updateDiligenceItem}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/><input type="hidden" name="id" value={item.id}/><select name="status" defaultValue={item.status}><option value="open">Open</option><option value="requested">Requested</option><option value="received">Received</option><option value="verified">Verified</option><option value="flagged">Flagged</option><option value="not_applicable">N/A</option></select><button>Update</button></form></article>)}
          </section>
          <section className="operations-card">
            <header><div><span>Broker contact</span><h2>Interaction history</h2></div></header>
            <form className="interaction-create" action={addBrokerInteraction}>
              <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/>
              <input name="contact_name" defaultValue={opportunity.brokerName ?? ""} placeholder="Contact name"/>
              <select name="interaction_type"><option value="email">Email</option><option value="call">Call</option><option value="meeting">Meeting</option><option value="note">Note</option></select>
              <textarea name="summary" required placeholder="What happened and what comes next?"/>
              <button type="submit">Save interaction</button>
            </form>
            {interactions.map((item)=><article className="timeline-item" key={item.id}><span>{item.interaction_type} · {new Date(item.occurred_at).toLocaleDateString()}</span><strong>{item.contact_name ?? "Broker contact"}</strong><p>{item.summary}</p></article>)}
          </section>
          <section className="operations-card operations-card--activity">
            <header><div><span>Deal activity</span><h2>History</h2></div></header>
            {activities.map((item)=><article className="timeline-item" key={item.id}><span>{new Date(item.created_at).toLocaleString()}</span><p>{item.description}</p></article>)}
          </section>
        </div>}
      </div>
    </PlatformShell>
  );
}
