import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { opportunities, platformTasks } from "@/lib/demo-data";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <PlatformShell locale={locale} active="overview">
      <div className="dashboard-content">
        <PageHeading
          eyebrow="Good morning, Geovannia"
          title="Your acquisition overview"
          body="Track the opportunities and next steps that matter most."
          action={<Link className="button button--primary" href={`/${locale}/dashboard/opportunities`}>Browse opportunities</Link>}
        />
        <div className="metric-grid">
          {[["Saved opportunities","24","+4 this week"],["Active deals","7","3 need attention"],["Average AI score","76","+5 this month"],["Tasks due","5","2 due today"]].map(([label,value,detail]) => (
            <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
          ))}
        </div>
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel__header"><h2>Priority opportunities</h2><Link href={`/${locale}/dashboard/opportunities`}>View all →</Link></div>
            {opportunities.slice(0,3).map((deal) => (
              <div className="deal-row" key={deal.id}>
                <div className="deal-name"><strong>{deal.name}</strong><span>{deal.location}</span></div>
                <span>{deal.price}</span><span className="stage">{deal.status}</span><span className="deal-score">{deal.score}</span>
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="panel__header"><h2>Next actions</h2><Link href={`/${locale}/dashboard/tasks`}>View tasks →</Link></div>
            <div className="task-list">
              {platformTasks.slice(0,3).map((task) => <article className="task" key={task.title}><strong>{task.title}</strong><span>{task.due}</span></article>)}
            </div>
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
