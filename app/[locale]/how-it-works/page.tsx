import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { getDictionary, isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "/how-it-works", {
    title: "How Crestview works",
    description:
      "A simple, guided path for finding, evaluating, purchasing, and operating a business—whether you are a first-time or experienced buyer.",
  });
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale);
  const es = locale === "es";
  return <><MarketingHeader locale={locale} /><main>
    <section className="marketing-page-hero"><div className="shell">
      <p className="eyebrow">{copy.home.processLabel}</p>
      <h1>{es ? "Comprar un negocio, explicado paso a paso." : "Buying a business, explained step by step."}</h1>
      <p>{es ? "Crestview fue creado para cualquier persona que quiera comprar un negocio, con experiencia o sin ella. Explora oportunidades, elige una, sigue una lista guiada y mantén el negocio organizado en un solo lugar después de la compra." : "Crestview was built for anyone who wants to buy a business—whether this is your first acquisition or you have done it before. Browse opportunities, choose one, follow a guided checklist, and keep the business organized in one place after the purchase."}</p>
      <div className="hero__actions"><Link className="button button--primary" href={`/${locale}/listings`}>{es ? "Ver anuncios" : "Browse listings"} →</Link><Link className="button button--light" href={`/${locale}/create-account`}>{es ? "Crear cuenta" : "Create an account"}</Link></div>
    </div></section>
    <section className="section section--dark"><div className="shell"><div className="section-heading"><div><p className="eyebrow eyebrow--lime">{copy.home.processLabel}</p><h2>{copy.home.processTitle}</h2></div><p>{copy.home.processBody}</p></div><div className="process-grid">{copy.home.steps.map(([title, body], index) => <article className="process-step" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
    <section className="section"><div className="shell journey-grid">
      <article><span>FOR EVERY BUYER</span><h2>{es ? "No necesitas saberlo todo para comenzar" : "You do not need to know everything to begin"}</h2><p>{es ? "La experiencia ayuda, pero no es un requisito. Las explicaciones claras y los próximos pasos te ayudan a avanzar con confianza." : "Experience helps, but it is not required. Plain-language explanations and clear next steps help you move forward with confidence."}</p></article>
      <article><span>GUIDED ACQUISITION</span><h2>{es ? "La lista te acompaña durante la compra" : "The checklist stays with you through the purchase"}</h2><p>{es ? "Organiza solicitudes, documentos, financiamiento, diligencia, asesores y decisiones sin tener que recordar todo por tu cuenta." : "Organize requests, documents, financing, diligence, advisers, and decisions without having to remember everything yourself."}</p></article>
      <article><span>ONE PLATFORM</span><h2>{es ? "El cierre no es el final" : "Closing is not the end"}</h2><p>{es ? "Cuando seas propietario, usa el espacio de trabajo para guardar información del negocio y administrar el trabajo continuo en la misma plataforma." : "Once you become the owner, use the workspace to keep business information and ongoing work on the same platform."}</p></article>
    </div></section>
    <section className="section section--compact"><div className="shell"><div className="cta-panel"><h2>{es ? "Encuentra un negocio adecuado para ti y deja que Crestview te muestre el siguiente paso." : "Find a business that feels right, then let Crestview show you the next step."}</h2><Link className="button button--primary" href={`/${locale}/listings`}>{es ? "Comenzar a explorar" : "Start browsing"} →</Link></div></div></section>
  </main><MarketingFooter locale={locale} /></>;
}
