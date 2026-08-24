import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/real-estate">): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "/real-estate", {
    title: "Real estate acquisition beta",
    description: "A coming-soon guided real estate acquisition workspace from Crestview.",
  });
}

const phases = [
  ["01", "Discover", "Define property type, geography, budget, yield, and operating plan before comparing opportunities."],
  ["02", "Verify the deal", "Separate listing claims, public records, broker documents, and Crestview calculations."],
  ["03", "Plan financing", "Organize equity, debt, reserves, lender questions, and a financing-ready summary."],
  ["04", "Complete diligence", "Track title, zoning, environmental, leases, inspections, insurance, taxes, and financial records."],
  ["05", "Offer and close", "Keep the LOI, contingencies, professionals, evidence, closing work, and post-close plan together."],
] as const;

export default async function RealEstatePage({ params }: PageProps<"/[locale]/real-estate">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  return <>
    <MarketingHeader locale={locale}/>
    <main className="real-estate-beta">
      <section className="real-estate-hero shell">
        <div className="coming-soon-badge"><span>Beta</span>{es ? "Próximamente" : "Coming soon"}</div>
        <p className="eyebrow">{es ? "Adquisición de bienes raíces" : "Real estate acquisition"}</p>
        <h1>{es ? "La metodología de Crestview, creada para comprar propiedades." : "The Crestview methodology, built for buying real estate."}</h1>
        <p>{es ? "Un espacio guiado para pasar de una oportunidad a una decisión documentada—sin mezclar hechos de la fuente, cálculos y preguntas pendientes." : "A guided workspace for moving from an opportunity to a documented decision—without mixing source facts, calculations, and unanswered questions."}</p>
        <div className="real-estate-actions"><Link className="button button--primary" href={`/${locale}/create-account`}>{es ? "Crear cuenta y recibir novedades" : "Create account for updates"}</Link><Link className="button button--light" href={`/${locale}/how-it-works`}>{es ? "Ver la metodología actual" : "See the current methodology"}</Link></div>
        <div className="beta-notice"><strong>{es ? "Vista previa, no mercado activo" : "Preview only—not an active marketplace"}</strong><span>{es ? "Las herramientas de bienes raíces y los anuncios de propiedades aún no están disponibles. La compra de negocios actual continúa funcionando normalmente." : "Real estate tools and property listings are not available yet. Crestview’s current business-acquisition experience remains fully available."}</span></div>
      </section>
      <section className="real-estate-method shell">
        <div className="real-estate-method__heading"><p className="eyebrow">{es ? "Metodología beta" : "Beta methodology"}</p><h2>{es ? "Una ruta clara desde la búsqueda hasta el cierre." : "One clear path from search through closing."}</h2></div>
        <div className="real-estate-phase-grid">{phases.map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>
      <section className="real-estate-preview-band"><div className="shell real-estate-preview-grid">
        <div><span>{es ? "PASAPORTE DE PROPIEDAD" : "PROPERTY PASSPORT"}</span><h2>{es ? "Saber qué es un hecho, qué es una estimación y qué falta." : "Know what is a fact, what is an estimate, and what is still missing."}</h2><p>{es ? "La versión beta está diseñada para conservar la procedencia de cada dato y marcar las decisiones que requieren un abogado, contador, prestamista, inspector u otro profesional." : "The beta is designed to preserve the source of each claim and flag decisions that need an attorney, accountant, lender, inspector, or other professional."}</p></div>
        <div className="property-passport-mock"><div><span>Source</span><strong>Broker provided</strong></div><div><span>Public record</span><strong>Needs review</strong></div><div><span>Financing</span><strong>Scenario saved</strong></div><div><span>Inspection</span><strong>Not received</strong></div></div>
      </div></section>
    </main>
    <MarketingFooter locale={locale}/>
  </>;
}
