import Link from "next/link";
import { Brand } from "@/components/brand";
import { UserProvider } from "@/components/user-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { getCrestviewUser } from "@/lib/current-user";
import type { Locale } from "@/lib/i18n";

const navItems = [
  ["overview", "Overview", "Resumen"],
  ["marketplace", "Marketplace", "Mercado"],
  ["listings", "Broker listings", "Anuncios del corredor"],
  ["inbox", "Deal inbox", "Bandeja de negocios"],
  ["opportunities", "Opportunities", "Oportunidades"],
  ["lists", "Saved lists", "Listas guardadas"],
  ["pipeline", "Pipeline", "Proceso"],
  ["tasks", "Tasks", "Tareas"],
  ["reports", "Reports", "Informes"],
  ["documents", "Documents", "Documentos"],
  ["workforce", "Workforce", "Personal"],
  ["plans", "Plans", "Planes"],
  ["settings", "Settings", "Configuración"],
] as const;

const navGroups = [
  { label: ["Marketplace", "Mercado"], slugs: ["overview", "marketplace", "listings", "inbox"] },
  { label: ["Acquisition workspace", "Espacio de adquisición"], slugs: ["opportunities", "lists", "pipeline"] },
  { label: ["Operations", "Operaciones"], slugs: ["tasks", "documents", "reports", "workforce"] },
  { label: ["Account", "Cuenta"], slugs: ["plans", "settings"] },
] as const;

type NavSlug = (typeof navItems)[number][0];

function navHref(locale: Locale, slug: (typeof navItems)[number][0]) {
  if (slug === "overview") return `/${locale}/dashboard`;
  if (slug === "plans") return `/${locale}/pricing`;
  return `/${locale}/dashboard/${slug}`;
}

export async function PlatformShell({
  locale,
  active,
  children,
}: {
  locale: Locale;
  active: NavSlug;
  children: React.ReactNode;
}) {
  const user = await getCrestviewUser(locale);
  const initials = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("") || "CV";

  return (
    <UserProvider user={{ displayName: user.displayName, email: user.email }}>
    <main className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Brand locale={locale} />
          <details className="mobile-nav">
            <summary>
              <span>{locale === "es" ? "Menú" : "Menu"}</span>
              <span className="mobile-nav__icon" aria-hidden="true">☰</span>
            </summary>
            <nav aria-label="Mobile dashboard navigation">
              {navItems.map(([slug, english, spanish]) => (
                <Link
                  className={slug === active ? "is-active" : ""}
                  href={navHref(locale, slug)}
                  key={slug}
                >
                  <span className="nav-dot" aria-hidden="true" />
                  {locale === "es" ? spanish : english}
                </Link>
              ))}
            </nav>
          </details>
        </div>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navGroups.map((group) => (
            <div className="sidebar-nav__group" key={group.label[0]}>
              <span>{locale === "es" ? group.label[1] : group.label[0]}</span>
              {group.slugs.map((slug) => {
                const item = navItems.find(([candidate]) => candidate === slug)!;
                return (
                  <Link className={slug === active ? "is-active" : ""} href={navHref(locale, slug)} key={slug}>
                    <span className="nav-dot" aria-hidden="true" />
                    {locale === "es" ? item[2] : item[1]}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="listing-alert">
          <span className="listing-alert__icon" aria-hidden="true">◎</span>
          <strong>{locale === "es" ? "Recibe alertas de anuncios" : "Get listing alerts"}</strong>
          <p>{locale === "es" ? "Recibe una notificación cuando se publique un negocio que coincida con tus preferencias." : "Receive a notification when a business matching your preferences is listed."}</p>
          <Link href={`/${locale}/dashboard/settings#listing-alerts`}>{locale === "es" ? "Configurar preferencias →" : "Set preferences →"}</Link>
        </div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="organization">
            <span className="organization__avatar">CH</span>
            {"organizationName" in user ? user.organizationName : "Crestview Holdings"}
          </div>
          <div className="user-chip">
            <LocaleSwitcher locale={locale} compact />
            {user.email.toLowerCase() === "agui2087@outlook.com" && <Link className="admin-switch" href={`/${locale}/dashboard/admin`}>{locale === "es" ? "Vista admin" : "Admin view"}</Link>}
            <Link href={`/${locale}`}>{locale === "es" ? "Sitio web" : "Website"}</Link>
            <Link className="notification-link" href={`/${locale}/dashboard/inbox`} aria-label={locale === "es" ? "Notificaciones" : "Notifications"}>●</Link>
            <strong>{user.displayName}</strong>
            <span title={user.displayName}>{initials}</span>
            <a href={user.source === "local" ? `/api/local-auth/signout?return_to=/${locale}` : chatGPTSignOutPath(`/${locale}`)}>{locale === "es" ? "Salir" : "Sign out"}</a>
          </div>
        </header>
        {children}
      </section>
    </main>
    </UserProvider>
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
