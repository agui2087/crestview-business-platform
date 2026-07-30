import Link from "next/link";
import { notFound } from "next/navigation";
import { AcquisitionPlanner } from "@/components/acquisition-planner";
import { GuidedAcquisitionWorkspace } from "@/components/guided-acquisition-workspace";
import { PlatformShell } from "@/components/platform-shell";
import { getOpportunity, opportunities } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { calculateDealScore } from "@/lib/deal-score";
import { addBrokerInteraction, addDiligenceItem, addDiligenceTemplate, addOpportunityNote, addOpportunityToList, beginAcquisition, saveOpportunity, updateDiligenceItem } from "../actions";

export function generateStaticParams() {
  return opportunities.flatMap((item) => ["en", "es"].map((locale) => ({ locale, id: item.id })));
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const opportunity = getOpportunity(id);
  if (!opportunity) notFound();
  const es = locale === "es";
  const dealScore = calculateDealScore(opportunity);
  let workspace: {
    stage: string;
    current_step: number;
    checklist_progress: Record<string, string>;
    step_notes: Record<string, string>;
    valuation_inputs: Record<string, string>;
  } | null = null;
  let diligence: Array<{ id: string; category: string; title: string; status: string; due_date: string | null; reason: string | null; guidance_source: string; source_url: string | null; risk_level: string; assigned_role: string | null }> = [];
  let guidanceProfile: { industry_type: string; purchase_structure: string; financing_type: string; state_code: string; has_employees: boolean; includes_real_estate: boolean; includes_inventory: boolean; first_acquisition: boolean } | null = null;
  let evidence: Array<{ id: string; diligence_item_id: string; label: string; evidence_type: string; source_url: string | null; verification_status: string }> = [];
  let professionals: Array<{ id: string; role: string; display_name: string; organization: string | null; responsibility: string | null; status: string }> = [];
  let transition: Array<{ id: string; horizon: string; category: string; title: string; owner: string | null; status: string }> = [];
  let sba: { purchase_price: number; buyer_injection: number; seller_note: number; working_capital: number; annual_cash_flow: number; interest_rate: number; term_years: number; lender_status: string } | null = null;
  let interactions: Array<{ id: string; interaction_type: string; summary: string; contact_name: string | null; occurred_at: string }> = [];
  let activities: Array<{ id: string; description: string; created_at: string }> = [];
  let notes: Array<{ id: string; body: string; created_at: string }> = [];
  let lists: Array<{ id: string; name: string }> = [];
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
      const [{ data: diligenceData }, { data: interactionData }, { data: activityData }, { data: noteData }, { data: listData }, { data: profileData }, { data: evidenceData }, { data: professionalData }, { data: transitionData }, { data: sbaData }] = await Promise.all([
        supabase.from("diligence_items").select("id,category,title,status,due_date,reason,guidance_source,source_url,risk_level,assigned_role").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("category"),
        supabase.from("broker_interactions").select("id,interaction_type,summary,contact_name,occurred_at").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("occurred_at", { ascending: false }).limit(10),
        supabase.from("deal_activities").select("id,description,created_at").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("created_at", { ascending: false }).limit(12),
        supabase.from("opportunity_notes").select("id,body,created_at").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("opportunity_lists").select("id,name").eq("user_id", user.id).order("name"),
        supabase.from("deal_guidance_profiles").select("industry_type,purchase_structure,financing_type,state_code,has_employees,includes_real_estate,includes_inventory,first_acquisition").eq("user_id", user.id).eq("opportunity_key", opportunity.id).maybeSingle(),
        supabase.from("diligence_evidence").select("id,diligence_item_id,label,evidence_type,source_url,verification_status").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("created_at"),
        supabase.from("deal_professionals").select("id,role,display_name,organization,responsibility,status").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("role"),
        supabase.from("transition_items").select("id,horizon,category,title,owner,status").eq("user_id", user.id).eq("opportunity_key", opportunity.id).order("horizon"),
        supabase.from("sba_readiness_profiles").select("purchase_price,buyer_injection,seller_note,working_capital,annual_cash_flow,interest_rate,term_years,lender_status").eq("user_id", user.id).eq("opportunity_key", opportunity.id).maybeSingle(),
      ]);
      diligence = diligenceData ?? [];
      guidanceProfile = profileData ?? null;
      evidence = evidenceData ?? [];
      professionals = professionalData ?? [];
      transition = transitionData ?? [];
      sba = sbaData ?? null;
      interactions = interactionData ?? [];
      activities = activityData ?? [];
      notes = noteData ?? [];
      lists = listData ?? [];
    }
  }

  return (
    <PlatformShell locale={locale} active="opportunities">
      <div className="dashboard-content">
        <Link className="back-link" href={`/${locale}/dashboard/opportunities`}>{es ? "← Todas las oportunidades" : "← All opportunities"}</Link>
        <div className="detail-heading">
          <div><span>{opportunity.source} · {opportunity.sourceId}</span><h1>{opportunity.title}</h1><p>{opportunity.industry} · {opportunity.location}</p></div>
          <div className="detail-actions">
            <form action={saveOpportunity}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="opportunity_key" value={opportunity.id} />
              <button className="button button--light" type="submit">{workspace ? (es ? "Guardado ✓" : "Saved ✓") : (es ? "Guardar oportunidad" : "Save opportunity")}</button>
            </form>
            <form action={beginAcquisition}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="opportunity_key" value={opportunity.id} />
              <button className="button button--primary" type="submit">{workspace && workspace.stage !== "saved" ? (es ? "Abrir en el proceso" : "Open in pipeline") : (es ? "Iniciar adquisición" : "Begin acquisition")}</button>
            </form>
            <a className="button button--light" href={opportunity.sourceUrl} target="_blank" rel="noreferrer">{es ? "Ver anuncio original ↗" : "View source listing ↗"}</a>
          </div>
        </div>
        <div className="source-warning">{es ? "Información proporcionada por el vendedor o corredor. Crestview no ha verificado el anuncio. Última revisión" : "Seller or broker reported information. Crestview has not independently verified the listing. Last checked"} {opportunity.lastChecked}.</div>
        <nav className="deal-workspace-nav" aria-label="Deal workspace sections">
          <a href="#summary">{es ? "Resumen" : "Summary"}</a><a href="#valuation">{es ? "Plan de adquisición" : "Acquisition plan"}</a><a href="#guided-plan">{es ? "Espacio guiado" : "Guided workspace"}</a><a href="#diligence">{es ? "Diligencia" : "Diligence"}</a><a href="#broker">{es ? "Actividad del corredor" : "Broker activity"}</a><a href="#notes">{es ? "Notas privadas" : "Private notes"}</a>
        </nav>
        <div className="detail-metrics" id="summary">
          {[[es ? "Precio solicitado" : "Asking price",opportunity.price],[es ? "Ingresos" : "Revenue",opportunity.revenue],[es ? "Flujo de caja / SDE" : "Cash flow / SDE",opportunity.cashFlow],["EBITDA",opportunity.ebitda]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
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
        <section className="score-card">
          <div className="score-card__value"><span>{es ? "Puntaje explicable" : "Explainable score"}</span><strong>{dealScore.score}</strong><small>/ 100 · v{dealScore.version} · {es ? "confianza" : "confidence"} {dealScore.confidence}</small></div>
          <div className="score-factors">{dealScore.factors.map((factor) => <div key={factor.label}><span>{factor.label}</span><strong>{factor.earned}/{factor.weight}</strong></div>)}</div>
          <p>{es ? "El puntaje usa solo datos públicos y penaliza información faltante. No es una recomendación de inversión." : "The score uses only public listing data and penalizes missing information. It is not an investment recommendation."}</p>
        </section>
        <div id="valuation"><AcquisitionPlanner opportunity={opportunity} initialWorkspace={workspace} locale={locale} /></div>
        {workspace && workspace.stage !== "saved" && <GuidedAcquisitionWorkspace
          locale={locale} opportunityKey={opportunity.id} industry={opportunity.industry}
          defaultPrice={opportunity.priceValue ?? 0} defaultCashFlow={opportunity.cashFlowValue ?? 0}
          profile={guidanceProfile} diligence={diligence} evidence={evidence}
          professionals={professionals} transition={transition} sba={sba}
        />}
        <section className="notes-lists-grid" id="notes">
          <article className="operations-card">
            <header><div><span>Private research</span><h2>Opportunity notes</h2></div></header>
            <form className="interaction-create" action={addOpportunityNote}>
              <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/>
              <textarea name="body" required placeholder="Record an observation, question, or decision. Only your account can see this note."/>
              <button type="submit">Add private note</button>
            </form>
            {notes.map((note) => <article className="timeline-item" key={note.id}><span>{new Date(note.created_at).toLocaleString(locale)}</span><p>{note.body}</p></article>)}
            {!notes.length && <p className="muted">No private notes yet.</p>}
          </article>
          <article className="operations-card">
            <header><div><span>Organization</span><h2>Add to a saved list</h2></div></header>
            {lists.length ? <form className="inline-create" action={addOpportunityToList}>
              <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/>
              <select name="list_id" aria-label="Saved list">{lists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}</select>
              <button type="submit">Add to list</button>
            </form> : <p>Create a saved list first, then return here to add this opportunity.</p>}
            <Link className="button button--light" href={`/${locale}/dashboard/lists`}>Manage saved lists</Link>
          </article>
        </section>
        {workspace && workspace.stage !== "saved" && <div className="deal-operations">
          <section className="operations-card" id="diligence">
            <header><div><span>Due diligence</span><h2>Verification tracker</h2></div><strong>{diligence.filter((item)=>item.status === "verified").length}/{diligence.length} verified</strong></header>
            <form className="template-picker" action={addDiligenceTemplate}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/><select name="template"><option value="general">General business</option><option value="service">Service business</option><option value="retail">Retail or restaurant</option><option value="healthcare">Healthcare</option></select><button>Load checklist template</button></form>
            <form className="inline-create" action={addDiligenceItem}>
              <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/>
              <select name="category"><option>Financial</option><option>Legal</option><option>Operational</option><option>Customer</option><option>Employee</option><option>Compliance</option></select>
              <input name="title" required placeholder="Item to verify"/>
              <input name="due_date" type="date"/>
              <button type="submit">Add</button>
            </form>
            {diligence.map((item)=><article className="diligence-row" key={item.id}><div><span>{item.category}</span><strong>{item.title}</strong><small>{item.due_date ?? "No due date"}</small></div><form action={updateDiligenceItem}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunity.id}/><input type="hidden" name="id" value={item.id}/><select name="status" defaultValue={item.status}><option value="open">Open</option><option value="requested">Requested</option><option value="received">Received</option><option value="verified">Verified</option><option value="flagged">Flagged</option><option value="not_applicable">N/A</option></select><button>Update</button></form></article>)}
          </section>
          <section className="operations-card" id="broker">
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
