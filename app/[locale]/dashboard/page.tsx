import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getOpportunity } from "@/lib/demo-data";
import { getCrestviewUser } from "@/lib/current-user";
import { isLocale } from "@/lib/i18n";
import { platformCopy } from "@/lib/platform-copy";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { BuyerCommandCenter } from "@/components/buyer-command-center";
import type { BuyerFitPreferences } from "@/lib/deal-score";

export const metadata: Metadata = { title: "Overview" };

type Deal = { id: string; opportunity_key: string; stage: string; next_action: string | null; updated_at: string };
type Task = { id: string; title: string; due_date: string | null; priority: string; opportunity_key: string | null };

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = platformCopy(locale);
  const user = await getCrestviewUser(locale);
  let deals: Deal[] = [];
  let tasks: Task[] = [];
  let diligenceCount = 0;
  let flaggedCount = 0;
  let primaryRole = "buyer";
  let brokerQueueCount = 0;
  let buyerProfile: (NonNullable<BuyerFitPreferences> & { desired_owner_income: number | null; acquisition_timeline: string | null; funding_status: string | null; experience_level: string | null; buyer_summary: string | null }) | null = null;
  let buyerFinance: { available_cash: number | null; buyer_injection_percent: number; illustrative_interest_rate: number } | null = null;
  if (isSupabaseConfigured() && user.source === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const accountRoles = "accountRoles" in user ? user.accountRoles : ["buyer"];
      primaryRole = accountRoles.includes("broker") ? "broker" : accountRoles.includes("advisor") ? "advisor" : "buyer";
      const [{ data: dealData }, { data: taskData }, { count: diligence }, { count: flagged }, { count: brokerQueue }, { data: preferenceData }, { data: financeData }] = await Promise.all([
        supabase.from("saved_opportunities").select("id,opportunity_key,stage,next_action,updated_at").eq("user_id", authUser.id).order("updated_at", { ascending: false }).limit(8),
        supabase.from("deal_tasks").select("id,title,due_date,priority,opportunity_key").eq("user_id", authUser.id).eq("status", "open").order("due_date").limit(6),
        supabase.from("diligence_items").select("*", { count: "exact", head: true }).eq("user_id", authUser.id).neq("status", "verified"),
        supabase.from("diligence_items").select("*", { count: "exact", head: true }).eq("user_id", authUser.id).eq("status", "flagged"),
        supabase.from("deal_inquiries").select("*", { count: "exact", head: true }).eq("broker_id", authUser.id).or("status.in.(submitted,nda_signed,offer),financial_access_status.eq.requested"),
        supabase.from("buyer_preferences").select("industries,locations,maximum_price,minimum_cash_flow,seller_financing_preferred,desired_owner_income,acquisition_timeline,funding_status,experience_level,buyer_summary").eq("user_id", authUser.id).maybeSingle(),
        supabase.from("buyer_financial_profiles").select("available_cash,buyer_injection_percent,illustrative_interest_rate").eq("user_id", authUser.id).maybeSingle(),
      ]);
      deals = (dealData ?? []) as Deal[];
      tasks = (taskData ?? []) as Task[];
      diligenceCount = diligence ?? 0;
      flaggedCount = flagged ?? 0;
      brokerQueueCount = brokerQueue ?? 0;
      buyerProfile = preferenceData as typeof buyerProfile;
      buyerFinance = financeData;
    }
  }
  const activeDeals = deals.filter((deal) => !["saved", "complete", "passed"].includes(deal.stage)).length;
  return (
    <PlatformShell locale={locale} active="overview">
      <div className="dashboard-content">
        <PageHeading
          eyebrow={`${locale === "es" ? "Hola" : "Hello"}, ${user.displayName.split(" ")[0]}`}
          title={text.overview.title}
          body={text.overview.body}
        />
        <section className={`role-home-card role-home-card--${primaryRole}`}>
          <div>
            <span>{primaryRole === "broker" ? "Broker workspace" : primaryRole === "advisor" ? "Advisor workspace" : "Buyer workspace"}</span>
            <h2>{primaryRole === "broker" ? "Review qualified buyer activity without chasing routine NDA requests." : primaryRole === "advisor" ? "Keep client diligence, documents, and open questions together." : "Move from search to a confident acquisition decision."}</h2>
            <p>{primaryRole === "broker" ? "NDA delivery is automatic. Your action queue only surfaces buyers, financial requests, and offers that need judgment." : primaryRole === "advisor" ? "Open the pipeline to review deal progress or continue a secure deal conversation." : "Complete your buyer profile once, then reuse it when requesting information from brokers."}</p>
          </div>
          <div className="role-home-actions">
            {primaryRole === "broker" && <><div className="role-home-count"><strong>{brokerQueueCount}</strong><span>items need attention</span></div><Link className="button button--primary" href={`/${locale}/dashboard/inbox`}>Open action queue</Link><Link className="button button--light" href={`/${locale}/dashboard/listings`}>Manage listings</Link></>}
            {primaryRole === "buyer" && <><Link className="button button--primary" href={`/${locale}/dashboard/settings`}>Complete buyer profile</Link><Link className="button button--light" href={`/${locale}/dashboard/marketplace`}>Browse broker listings</Link><Link className="role-home-tertiary" href={`/${locale}/dashboard/opportunities`}>Browse all opportunities →</Link></>}
            {primaryRole === "advisor" && <><Link className="button button--primary" href={`/${locale}/dashboard/pipeline`}>Review client pipeline</Link><Link className="button button--light" href={`/${locale}/dashboard/inbox`}>Open deal inbox</Link></>}
          </div>
        </section>
        {primaryRole === "buyer" && <BuyerCommandCenter locale={locale} profile={buyerProfile} finance={buyerFinance} activeDeals={activeDeals} openTasks={tasks.length} />}
        <div className="metric-grid">
          {[
            [text.overview.saved, String(deals.length), locale === "es" ? "Guardadas en tu cuenta" : "Stored in your account"],
            [text.overview.active, String(activeDeals), `${flaggedCount} ${text.overview.attention.toLowerCase()}`],
            [text.overview.diligence, String(diligenceCount), locale === "es" ? "Pendientes de verificar" : "Awaiting verification"],
            [text.overview.due, String(tasks.length), locale === "es" ? "En tu lista de trabajo" : "In your work queue"],
          ].map(([label,value,detail]) => (
            <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
          ))}
        </div>
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel__header"><h2>{text.overview.priority}</h2><Link href={`/${locale}/dashboard/pipeline`}>{text.common.viewAll} →</Link></div>
            {deals.slice(0, 5).map((deal) => {
              const opportunity = getOpportunity(deal.opportunity_key);
              return opportunity ? <Link className="deal-row deal-row--linked" href={`/${locale}/dashboard/opportunities/${opportunity.id}`} key={deal.id}>
                <div className="deal-name"><strong>{opportunity.title}</strong><span>{opportunity.location}</span></div>
                <span>{opportunity.price}</span><span className="stage">{deal.stage}</span><span>{new Date(deal.updated_at).toLocaleDateString(locale)}</span>
              </Link> : null;
            })}
            {!deals.length && <p className="panel-empty">{text.overview.emptyDeals}</p>}
          </section>
          <section className="panel">
            <div className="panel__header"><h2>{text.overview.actions}</h2><Link href={`/${locale}/dashboard/tasks`}>{text.common.viewAll} →</Link></div>
            <div className="task-list">
              {tasks.map((task) => <article className="task" key={task.id}><strong>{task.title}</strong><span>{task.due_date ? new Date(`${task.due_date}T12:00:00`).toLocaleDateString(locale) : text.common.noDueDate}</span></article>)}
              {!tasks.length && <p className="panel-empty">{text.overview.emptyTasks}</p>}
            </div>
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
