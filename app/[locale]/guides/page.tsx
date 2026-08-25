import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { buyerGuides } from "@/lib/guides";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "/guides", {
    title: "How to buy a business | Free buyer guides",
    description: "Free step-by-step guides, checklists, and calculators for finding, evaluating, financing, and buying a small business.",
  });
}

export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Crestview Business Buyer Guides",
    description: "Practical resources for first-time and experienced small-business buyers.",
    url: `https://www.crestviewplatform.com/${locale}/guides`,
    hasPart: buyerGuides.map((guide) => ({ "@type": "Article", headline: guide.title, url: `https://www.crestviewplatform.com/${locale}/guides/${guide.slug}` })),
  };
  return <>
    <MarketingHeader locale={locale} />
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="guide-hero"><div className="shell guide-hero__grid">
        <div><p className="eyebrow">{es ? "CENTRO DE APRENDIZAJE" : "BUSINESS BUYER LEARNING CENTER"}</p><h1>{es ? "Aprende a comprar un negocio, paso a paso." : "Learn how to buy a business, step by step."}</h1><p>{es ? "Guías claras, listas y calculadoras para ayudarte a pasar de tu primera búsqueda al cierre y la transición." : "Clear guides, checklists, and calculators that help you move from your first search through diligence, closing, and transition."}</p><div className="hero__actions"><Link className="button button--primary" href={`/${locale}/guides/how-to-buy-a-business`}>{es ? "Leer la guía completa" : "Read the complete guide"} →</Link><Link className="button button--light" href={`/${locale}/guides/tools`}>{es ? "Abrir calculadoras" : "Open free calculators"}</Link></div></div>
        <aside className="guide-hero__path"><span>{es ? "TU CAMINO" : "YOUR BUYING PATH"}</span>{["Search", "Screen", "Finance", "Diligence", "Close", "Transition"].map((step, index) => <div key={step}><b>{index + 1}</b><strong>{step}</strong></div>)}</aside>
      </div></section>
      <section className="section guide-feature"><div className="shell"><article><div><span>{es ? "EMPIEZA AQUÍ" : "START HERE"}</span><h2>{buyerGuides[0].title}</h2><p>{buyerGuides[0].description}</p></div><Link href={`/${locale}/guides/${buyerGuides[0].slug}`}>{es ? "Abrir guía" : "Open guide"} →</Link></article></div></section>
      <section className="section section--compact"><div className="shell"><div className="guide-index-heading"><div><p className="eyebrow">{es ? "RECURSOS PRÁCTICOS" : "PRACTICAL RESOURCES"}</p><h2>{es ? "Respuestas para cada etapa de la compra" : "Answers for every stage of the purchase"}</h2></div><p>{es ? "Cada guía explica el tema, muestra qué verificar y te conecta con los próximos pasos." : "Each guide explains the topic, shows what to verify, and connects you to the next step."}</p></div><div className="guide-card-grid">{buyerGuides.slice(1).map((guide, index) => <article className="guide-card" key={guide.slug}><span>0{index + 1}</span><small>{guide.searchIntent} · {guide.readTime}</small><h2>{guide.shortTitle}</h2><p>{guide.description}</p><Link href={`/${locale}/guides/${guide.slug}`}>{es ? "Leer guía" : "Read guide"} →</Link></article>)}</div></div></section>
      <section className="section section--dark"><div className="shell guide-tool-banner"><div><p className="eyebrow eyebrow--lime">{es ? "HERRAMIENTAS GRATUITAS" : "FREE BUYER TOOLS"}</p><h2>{es ? "Convierte lo que aprendes en una decisión concreta." : "Turn what you learn into a concrete decision."}</h2><p>{es ? "Estima tu presupuesto, prueba una valoración y descarga una lista organizada de diligencia." : "Estimate your budget, test a valuation, and download an organized due-diligence checklist."}</p></div><Link className="button" href={`/${locale}/guides/tools`}>{es ? "Usar herramientas" : "Use the tools"} →</Link></div></section>
    </main>
    <MarketingFooter locale={locale} />
  </>;
}
