import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Business ownership, made clearer",
};

export default async function LandingPage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  const user = await getChatGPTUser();

  return (
    <>
      <header className="site-header">
        <div className="shell site-header__inner">
          <Brand locale={locale} />
          <nav className="nav" aria-label="Primary navigation">
            <a href="#platform">{copy.nav.platform}</a>
            <a href="#how-it-works">{copy.nav.how}</a>
            <a href="#vision">{copy.nav.vision}</a>
            <Link href={`/${locale}/pricing`}>{locale === "es" ? "Planes" : "Pricing"}</Link>
          </nav>
          <div className="header-actions">
            <LocaleSwitcher locale={locale} />
            <Link className="button button--light" href={user ? `/${locale}/dashboard` : `/${locale}/sign-in`}>
              {user ? (locale === "es" ? "Abrir panel" : "Open dashboard") : copy.nav.signIn}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="shell hero__grid">
            <div>
              <p className="eyebrow">{copy.home.eyebrow}</p>
              <h1>
                {copy.home.titleBefore} <em>{copy.home.titleEmphasis}</em>
              </h1>
              <p className="hero__copy">{copy.home.body}</p>
              <div className="hero__actions">
                <a className="button button--primary" href="#platform">
                  {copy.home.primary} <span aria-hidden="true">→</span>
                </a>
                <Link className="button button--light" href={`/${locale}/dashboard`}>
                  {copy.home.secondary}
                </Link>
              </div>
              <p className="hero__note">
                <span aria-hidden="true" />
                {copy.home.note}
              </p>
            </div>

            <div className="deal-preview" aria-label="DealFlow opportunity example">
              <article className="preview-card preview-card--main">
                <div className="preview-card__top">
                  <span className="mini-label">DealFlow AI</span>
                  <span className="status-pill">
                    {locale === "en" ? "Strong fit" : "Buen potencial"}
                  </span>
                </div>
                <h3>Pacific HVAC Services</h3>
                <span className="preview-card__location">San Diego, California</span>
                <div className="preview-metrics">
                  <div className="preview-metric">
                    <span>{locale === "en" ? "Price" : "Precio"}</span>
                    <strong>$1.8M</strong>
                  </div>
                  <div className="preview-metric">
                    <span>{locale === "en" ? "Revenue" : "Ingresos"}</span>
                    <strong>$2.7M</strong>
                  </div>
                  <div className="preview-metric">
                    <span>Cash flow</span>
                    <strong>$540K</strong>
                  </div>
                </div>
                <div className="signal-list">
                  <div className="signal">
                    <i aria-hidden="true" />
                    {locale === "en"
                      ? "Recurring commercial service contracts"
                      : "Contratos comerciales recurrentes"}
                  </div>
                  <div className="signal">
                    <i aria-hidden="true" />
                    {locale === "en"
                      ? "Seller financing available"
                      : "Financiamiento del vendedor disponible"}
                  </div>
                  <div className="signal signal--warning">
                    <i aria-hidden="true" />
                    {locale === "en"
                      ? "Customer concentration needs review"
                      : "Revisar concentración de clientes"}
                  </div>
                </div>
              </article>

              <article className="preview-card preview-card--score">
                <div className="score-row">
                  <div className="score-ring" aria-label="Score: 82 out of 100" />
                  <div className="score-copy">
                    <strong>
                      {locale === "en" ? "Explainable score" : "Puntaje explicable"}
                    </strong>
                    <span>
                      {locale === "en"
                        ? "Based on 11 factors · 3 items missing"
                        : "Basado en 11 factores · faltan 3 datos"}
                    </span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Platform principles">
          <div className="shell trust-strip__inner">
            <p>{copy.home.trust}</p>
            <div className="trust-points">
              {[copy.home.provenance, copy.home.explainable, copy.home.bilingual].map(
                (point) => (
                  <div className="trust-point" key={point}>
                    <span className="trust-icon" aria-hidden="true">✓</span>
                    {point}
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="section" id="platform">
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{copy.home.productsLabel}</p>
                <h2>{copy.home.productsTitle}</h2>
              </div>
              <p>{copy.home.productsBody}</p>
            </div>
            <div className="product-grid">
              <article className="product-card">
                <span className="product-card__number">01 · {copy.home.available}</span>
                <h3>{copy.home.dealflow}</h3>
                <p>{copy.home.dealflowBody}</p>
                <a className="product-link" href="#how-it-works">
                  {copy.home.learn} <span aria-hidden="true">→</span>
                </a>
              </article>
              <article className="product-card product-card--future">
                <span className="product-card__number">02 · {copy.home.planned}</span>
                <h3>{copy.home.workforce}</h3>
                <p>{copy.home.workforceBody}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--dark" id="how-it-works">
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow eyebrow--lime">{copy.home.processLabel}</p>
                <h2>{copy.home.processTitle}</h2>
              </div>
              <p>{copy.home.processBody}</p>
            </div>
            <div className="process-grid">
              {copy.home.steps.map(([title, body], index) => (
                <article className="process-step" key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="vision">
          <div className="shell">
            <div className="cta-panel">
              <h2>{copy.home.cta}</h2>
              <Link className="button button--primary" href={`/${locale}/dashboard`}>
                {copy.home.ctaButton} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer__inner">
          <Brand locale={locale} />
          <span>{copy.home.footer}</span>
          <span>© 2026 Crestview</span>
        </div>
      </footer>
    </>
  );
}
