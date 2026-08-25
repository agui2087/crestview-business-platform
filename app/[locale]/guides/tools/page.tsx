import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyerTools } from "@/components/buyer-tools";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "/guides/tools", { title: "Free business buying calculators and checklists", description: "Estimate a business purchase budget and valuation, then download a structured due-diligence checklist for your acquisition." });
}

export default async function BuyerToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const softwareLd = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Crestview Business Buyer Calculators", applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, url: `https://www.crestviewplatform.com/${locale}/guides/tools` };
  return <><MarketingHeader locale={locale} /><main><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} /><section className="guide-hero guide-hero--tools"><div className="shell"><p className="eyebrow">{es ? "HERRAMIENTAS GRATUITAS" : "FREE BUSINESS BUYER TOOLS"}</p><h1>{es ? "Haz los números antes de avanzar." : "Run the numbers before you move forward."}</h1><p>{es ? "Usa estimaciones conservadoras para enfocar tu búsqueda. Guarda la decisión final para información verificada y profesionales calificados." : "Use conservative estimates to focus your search. Base final decisions on verified information and qualified professional advice."}</p></div></section><section className="section"><div className="shell"><BuyerTools locale={locale} /><div className="download-panel"><div><span>{es ? "DESCARGA GRATUITA" : "FREE DOWNLOAD"}</span><h2>{es ? "Lista de diligencia para compradores" : "Business buyer due-diligence checklist"}</h2><p>{es ? "Un archivo organizado para rastrear solicitudes financieras, legales, operativas, comerciales y laborales." : "An organized file for tracking financial, legal, operational, commercial, and employee requests."}</p></div><a className="button button--primary" href="/business-buying-due-diligence-checklist.csv" download>{es ? "Descargar lista CSV" : "Download checklist CSV"} ↓</a></div><div className="tool-reading"><strong>{es ? "Aprende antes de calcular" : "Learn before you calculate"}</strong><Link href={`/${locale}/guides/how-much-money-do-you-need-to-buy-a-business`}>{es ? "¿Cuánto dinero necesitas?" : "How much money do you need to buy a business?"} →</Link><Link href={`/${locale}/guides/how-to-value-a-small-business`}>{es ? "Cómo valorar un negocio" : "How to value a small business"} →</Link><Link href={`/${locale}/guides/business-due-diligence-checklist`}>{es ? "Guía de diligencia" : "Business due-diligence guide"} →</Link></div></div></section></main><MarketingFooter locale={locale} /></>;
}
