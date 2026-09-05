import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { getDictionary, isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "", {
    title: locale === "es"
      ? "Crestview Platform | Compra un negocio con confianza"
      : "Crestview Platform | How to Buy a Business",
    description: locale === "es"
      ? "Crestview Platform ayuda a compradores a encontrar, evaluar, financiar y comprar una pequeña empresa con herramientas guiadas en un solo lugar."
      : "Crestview Platform helps first-time and experienced buyers find, evaluate, finance, and purchase a small business with guided tools in one place.",
    openGraph: {
      siteName: "Crestview Platform",
      title: locale === "es"
        ? "Crestview Platform | Compra un negocio con confianza"
        : "Crestview Platform | How to Buy a Business",
    },
  });
}

export default async function LandingPage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const copy = getDictionary(locale);
  return (
    <>
      <MarketingHeader locale={locale} />

      <main>
        <section className="hero">
          <div className="hero-shapes" aria-hidden="true">
            <span className="hero-shapes__arch" />
            <span className="hero-shapes__sun" />
            <span className="hero-shapes__step" />
          </div>
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
              <div className="deal-preview__canvas" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <article className="preview-card preview-card--main">
                <div className="preview-card__top">
                  <span className="mini-label">
                    {locale === "en" ? "Deal review" : "Revisión del negocio"}
                  </span>
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
                <div className="product-card__art product-card__art--path" aria-hidden="true"><i /><i /><i /></div>
                <span className="product-card__number">01 · {copy.home.available}</span>
                <h3>{copy.home.dealflow}</h3>
                <p>{copy.home.dealflowBody}</p>
                <Link className="product-link" href={`/${locale}/how-it-works`}>
                  {copy.home.learn} <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="product-card product-card--future">
                <div className="product-card__art product-card__art--people" aria-hidden="true"><i /><i /><i /></div>
                <span className="product-card__number">02 · {copy.home.planned}</span>
                <h3>{copy.home.workforce}</h3>
                <p>{copy.home.workforceBody}</p>
              </article>
              <article className="product-card product-card--beta">
                <div className="product-card__art product-card__art--property" aria-hidden="true"><i /><i /><i /></div>
                <span className="product-card__number">03 · BETA · {locale === "es" ? "PRÓXIMAMENTE" : "COMING SOON"}</span>
                <h3>{locale === "es" ? "Adquisición de bienes raíces" : "Real estate acquisition"}</h3>
                <p>{locale === "es" ? "La misma metodología guiada de Crestview para evaluar propiedades, financiamiento, diligencia y cierre." : "The same guided Crestview methodology for evaluating property opportunities, financing, diligence, and closing."}</p>
                <Link className="product-link" href={`/${locale}/real-estate`}>{locale === "es" ? "Ver la vista previa beta" : "See the beta preview"} <span aria-hidden="true">→</span></Link>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--dark" id="how-it-works">
          <div className="process-motif" aria-hidden="true"><span /><span /><span /></div>
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

        <section className="section home-learning-center">
          <div className="shell">
            <div className="section-heading">
              <div><p className="eyebrow">{locale === "es" ? "APRENDE ANTES DE COMPRAR" : "LEARN BEFORE YOU BUY"}</p><h2>{locale === "es" ? "Tu guía para comprar un negocio." : "Your guide to buying a business."}</h2></div>
              <p>{locale === "es" ? "Respuestas claras para compradores nuevos: desde encontrar un negocio y revisar sus finanzas hasta obtener financiamiento, completar la diligencia y cerrar." : "Clear answers for first-time buyers—from finding a business and reviewing its finances to securing financing, completing due diligence, and closing."}</p>
            </div>
            <div className="home-guide-grid">
              <Link href={`/${locale}/guides/how-to-buy-a-business`}><span>01</span><div><strong>{locale === "es" ? "Cómo comprar un negocio" : "How to buy a small business"}</strong><small>{locale === "es" ? "La guía completa, paso a paso" : "The complete step-by-step guide"}</small></div><b>→</b></Link>
              <Link href={`/${locale}/guides/business-due-diligence-checklist`}><span>02</span><div><strong>{locale === "es" ? "Lista de diligencia" : "Due-diligence checklist"}</strong><small>{locale === "es" ? "Qué solicitar y cómo verificarlo" : "What to request and how to verify it"}</small></div><b>→</b></Link>
              <Link href={`/${locale}/guides/how-to-finance-a-business-purchase`}><span>03</span><div><strong>{locale === "es" ? "Financiar una compra" : "Finance a business purchase"}</strong><small>{locale === "es" ? "Préstamos, capital y financiamiento del vendedor" : "Loans, equity, and seller financing"}</small></div><b>→</b></Link>
            </div>
            <div className="home-learning-actions"><Link className="button button--primary" href={`/${locale}/guides`}>{locale === "es" ? "Ver todas las guías" : "Explore all buyer guides"} →</Link><Link className="button button--light" href={`/${locale}/guides/tools`}>{locale === "es" ? "Usar calculadoras gratuitas" : "Use free calculators"}</Link></div>
          </div>
        </section>

        <section className="section" id="vision">
          <div className="shell">
            <div className="cta-panel">
              <div className="cta-panel__art" aria-hidden="true"><span /><span /><span /></div>
              <div className="cta-panel__content">
                <p className="eyebrow">{locale === "es" ? "TU PRÓXIMO PASO" : "YOUR NEXT MOVE"}</p>
                <h2>{copy.home.cta}</h2>
              </div>
              <Link className="button button--primary" href={`/${locale}/dashboard`}>
                {copy.home.ctaButton} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter locale={locale} />
    </>
  );
}
