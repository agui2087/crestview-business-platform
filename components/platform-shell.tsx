import Link from "next/link";
import { Brand } from "@/components/brand";
import type { Locale } from "@/lib/i18n";

const navItems = [
  ["overview", "Overview"],
  ["opportunities", "Opportunities"],
  ["pipeline", "Pipeline"],
  ["tasks", "Tasks"],
  ["documents", "Documents"],
  ["workforce", "Workforce"],
  ["settings", "Settings"],
] as const;

export function PlatformShell({
  locale,
  active,
  children,
}: {
  locale: Locale;
  active: (typeof navItems)[number][0];
  children: React.ReactNode;
}) {
  return (
    <main className="dashboard">
      <aside className="sidebar">
        <Brand locale={locale} />
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navItems.map(([slug, label]) => (
            <Link
              className={slug === active ? "is-active" : ""}
              href={slug === "overview" ? `/${locale}/dashboard` : `/${locale}/dashboard/${slug}`}
              key={slug}
            >
              <span className="nav-dot" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="listing-alert">
          <span className="listing-alert__icon" aria-hidden="true">◎</span>
          <strong>Get listing alerts</strong>
          <p>Receive a notification when a business matching your preferences is listed.</p>
          <Link href={`/${locale}/dashboard/settings#listing-alerts`}>Set preferences →</Link>
        </div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="organization">
            <span className="organization__avatar">CH</span>
            Crestview Holdings
          </div>
          <div className="user-chip">
            <Link href={`/${locale}`}>Website</Link>
            <span>GF</span>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}

export function PageHeading({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="workspace-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{body}</span>
      </div>
      {action}
    </div>
  );
}
