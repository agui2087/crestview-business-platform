import Link from "next/link";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { Locale } from "@/lib/i18n";

const labels = {
  en: { home: "Home", listings: "Listings", how: "How it works", vision: "Our vision", pricing: "Pricing", signIn: "Sign in", signUp: "Sign up", dashboard: "Dashboard", menu: "Menu", footer: "A business operating platform for thoughtful owners." },
  es: { home: "Inicio", listings: "Anuncios", how: "Cómo funciona", vision: "Nuestra visión", pricing: "Planes", signIn: "Iniciar sesión", signUp: "Crear cuenta", dashboard: "Panel", menu: "Menú", footer: "Una plataforma empresarial para propietarios reflexivos." },
} as const;

function MarketingLinks({ locale }: { locale: Locale }) {
  const text = labels[locale];
  return <>
    <Link href={`/${locale}`}>{text.home}</Link>
    <Link href={`/${locale}/listings`}>{text.listings}</Link>
    <Link href={`/${locale}/how-it-works`}>{text.how}</Link>
    <Link href={`/${locale}/vision`}>{text.vision}</Link>
    <Link href={`/${locale}/pricing`}>{text.pricing}</Link>
  </>;
}

export async function MarketingHeader({ locale }: { locale: Locale }) {
  const user = await getChatGPTUser();
  const text = labels[locale];
  return <header className="site-header">
    <div className="shell site-header__inner">
      <Brand locale={locale} />
      <nav className="nav" aria-label={locale === "es" ? "Navegación principal" : "Primary navigation"}>
        <MarketingLinks locale={locale} />
      </nav>
      <div className="header-actions">
        <LocaleSwitcher locale={locale} />
        {user ? <Link className="button button--primary desktop-account-action" href={`/${locale}/dashboard`}>{text.dashboard}</Link> : <>
          <Link className="button button--light desktop-account-action" href={`/${locale}/sign-in`}>{text.signIn}</Link>
          <Link className="button button--primary desktop-account-action" href={`/${locale}/create-account`}>{text.signUp}</Link>
        </>}
        <details className="marketing-mobile-nav">
          <summary aria-label={text.menu}><span>{text.menu}</span><i aria-hidden="true">☰</i></summary>
          <nav>
            <MarketingLinks locale={locale} />
            <hr />
            {user ? <Link className="mobile-account-link" href={`/${locale}/dashboard`}>{text.dashboard}</Link> : <>
              <Link href={`/${locale}/sign-in`}>{text.signIn}</Link>
              <Link className="mobile-account-link" href={`/${locale}/create-account`}>{text.signUp}</Link>
            </>}
          </nav>
        </details>
      </div>
    </div>
  </header>;
}

export function MarketingFooter({ locale }: { locale: Locale }) {
  return <footer className="footer"><div className="shell footer__inner"><Brand locale={locale} /><span>{labels[locale].footer}</span><span>© 2026 Crestview</span></div></footer>;
}
