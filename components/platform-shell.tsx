import Link from "next/link";
import { Brand } from "@/components/brand";
import { UserProvider } from "@/components/user-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { getCrestviewUser } from "@/lib/current-user";
import type { Locale } from "@/lib/i18n";

const navItems = [
  ["overview", "Overview", "Resumen", "⌂"],
  ["marketplace", "Marketplace", "Mercado", "⌕"],
  ["listings", "My listings", "Mis anuncios", "▤"],
  ["inbox", "Deal inbox", "Bandeja de negocios", "↔"],
  ["opportunities", "Browse listings", "Explorar anuncios", "◎"],
  ["lists", "Saved lists", "Listas guardadas", "♡"],
  ["pipeline", "Pipeline", "Proceso", "◇"],
  ["tasks", "Tasks", "Tareas", "✓"],
  ["reports", "Reports", "Informes", "↗"],
  ["documents", "Documents", "Documentos", "▣"],
  ["workforce", "Workforce", "Personal", "♙"],
  ["real-estate", "Real estate beta", "Bienes raíces beta", "⌂"],
  ["plans", "Plans & billing", "Planes y facturación", "$"],
  ["settings", "Settings", "Configuración", "⚙"],
] as const;

const navGroups = [
  { label: ["Home", "Inicio"], slugs: ["overview", "inbox"] },
  { label: ["Explore", "Explorar"], slugs: ["marketplace", "opportunities", "lists"] },
  { label: ["Workspace", "Espacio de trabajo"], slugs: ["pipeline", "tasks", "documents", "reports"] },
  { label: ["Sell", "Vender"], slugs: ["listings", "workforce"] },
  { label: ["Account", "Cuenta"], slugs: ["real-estate", "plans", "settings"] },
] as const;

type NavSlug = (typeof navItems)[number][0];

function navHref(locale: Locale, slug: (typeof navItems)[number][0]) {
  if (slug === "overview") return `/${locale}/dashboard`;
  if (slug === "plans") return `/${locale}/pricing`;
  if (slug === "real-estate") return `/${locale}/real-estate`;
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
  const roles = "accountRoles" in user ? user.accountRoles : ["buyer"];
  const isBroker = roles.includes("broker");
  const isBuyer = roles.includes("buyer") || roles.includes("advisor");
  const visible = (slug: NavSlug) => {
    if (slug === "listings") return isBroker;
    if (slug === "workforce") return isBroker || roles.includes("workforce");
    if (["opportunities", "lists", "pipeline"].includes(slug)) return isBuyer;
    return true;
  };
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
              {navItems.filter(([slug]) => visible(slug)).map(([slug, english, spanish, icon]) => (
                <Link
                  className={slug === active ? "is-active" : ""}
                  href={navHref(locale, slug)}
                  key={slug}
                >
                  <span className="nav-icon" aria-hidden="true">{icon}</span>
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
              {group.slugs.filter(visible).map((slug) => {
                const item = navItems.find(([candidate]) => candidate === slug)!;
                return (
                  <Link className={slug === active ? "is-active" : ""} href={navHref(locale, slug)} key={slug}>
                    <span className="nav-icon" aria-hidden="true">{item[3]}</span>
                    {locale === "es" ? item[2] : item[1]}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {isBuyer && <Link className="listing-alert" href={`/${locale}/dashboard/settings#listing-alerts`}>
          <span className="listing-alert__icon" aria-hidden="true">◎</span>
          <span><strong>{locale === "es" ? "Alertas de anuncios" : "Listing alerts"}</strong><small>{locale === "es" ? "Configurar preferencias" : "Set preferences"} →</small></span>
        </Link>}
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="organization" aria-label={locale === "es" ? "Organización actual" : "Current organization"}>
            <span className="organization__avatar">CH</span>
            {"organizationName" in user ? user.organizationName : "Crestview Holdings"}
          </div>
          <div className="user-chip">
            <Link className="notification-link" href={`/${locale}/dashboard/inbox#notifications`} aria-label={locale === "es" ? "Notificaciones" : "Notifications"}>○</Link>
            <details className="account-menu">
              <summary aria-label={locale === "es" ? "Abrir menú de cuenta" : "Open account menu"}>
                <span title={user.displayName}>{initials}</span>
                <strong>{user.displayName}</strong>
                <i aria-hidden="true">⌄</i>
              </summary>
              <div>
                <small>{user.email}</small>
                <LocaleSwitcher locale={locale} compact />
                {user.email.toLowerCase() === "agui2087@outlook.com" && <Link href={`/${locale}/dashboard/admin`}>{locale === "es" ? "Vista admin" : "Admin view"}</Link>}
                <Link href={`/${locale}`}>{locale === "es" ? "Sitio web" : "Website"}</Link>
                <a href={user.source === "chatgpt" ? chatGPTSignOutPath(`/${locale}`) : `/api/local-auth/signout?return_to=/${locale}`}>
                  {locale === "es" ? "Salir" : "Sign out"}
                </a>
              </div>
            </details>
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
