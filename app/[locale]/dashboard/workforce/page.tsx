import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";

export default async function WorkforcePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  return <PlatformShell locale={locale} active="workforce"><div className="dashboard-content">
    <PageHeading eyebrow="Product two" title="Workforce" body="A bilingual employee administration workspace for acquired businesses." action={<button className="button button--primary" disabled>Add employee</button>} />
    <div className="workforce-grid">{[["Employees","Profiles, positions, departments, managers, and employment status."],["Documents","Employee records with controlled access and expiration tracking."],["Training","Certifications, courses, and renewal reminders."],["PTO","Requests, approvals, and ledger backed balances."]].map(([title,body]) => <article className="feature-tile" key={title}><span>Planned module</span><h2>{title}</h2><p>{body}</p></article>)}</div>
  </div></PlatformShell>;
}
