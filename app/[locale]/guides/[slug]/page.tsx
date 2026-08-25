import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { buyerGuides, getGuide } from "@/lib/guides";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return (["en", "es"] as const).flatMap((locale) => buyerGuides.map((guide) => ({ locale, slug: guide.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return localizedPublicMetadata(locale === "es" ? "es" : "en", `/guides/${slug}`, {
    title: guide.title,
    description: guide.description,
    keywords: [guide.shortTitle, guide.searchIntent, "buy a small business", "business acquisition"],
  });
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const guide = getGuide(slug);
  if (!guide) notFound();
  const es = locale === "es";
  const related = guide.related.map(getGuide).filter(Boolean);
  const canonical = `https://www.crestviewplatform.com/${locale}/guides/${guide.slug}`;
  const articleLd = { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, datePublished: "2026-08-25", dateModified: "2026-08-25", author: { "@type": "Organization", name: "Crestview Editorial Team", url: "https://www.crestviewplatform.com/en" }, publisher: { "@type": "Organization", name: "Crestview", logo: { "@type": "ImageObject", url: "https://www.crestviewplatform.com/crestview-mark.svg" } }, mainEntityOfPage: canonical };
  const breadcrumbLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `https://www.crestviewplatform.com/${locale}` }, { "@type": "ListItem", position: 2, name: "Business buyer guides", item: `https://www.crestviewplatform.com/${locale}/guides` }, { "@type": "ListItem", position: 3, name: guide.shortTitle, item: canonical }] };
  return <>
    <MarketingHeader locale={locale} />
    <main className="article-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <header className="article-hero"><div className="shell article-hero__inner"><nav aria-label="Breadcrumb"><Link href={`/${locale}/guides`}>{es ? "Guías" : "Buyer guides"}</Link><span>›</span><span>{guide.shortTitle}</span></nav><p className="eyebrow">{guide.searchIntent}</p><h1>{guide.title}</h1><p className="article-standfirst">{guide.description}</p><div className="article-byline"><span>{es ? "Por" : "By"} <strong>Crestview Editorial Team</strong></span><span>{es ? "Actualizado" : "Updated"} {guide.updated}</span><span>{guide.readTime}</span></div></div></header>
      <div className="shell article-layout"><aside className="article-toc"><strong>{es ? "EN ESTA GUÍA" : "IN THIS GUIDE"}</strong>{guide.sections.map((section, index) => <a href={`#section-${index + 1}`} key={section.heading}>{section.heading}</a>)}<Link className="button button--primary" href={`/${locale}/guides/tools`}>{es ? "Abrir herramientas" : "Open buyer tools"}</Link></aside>
        <article className="article-body"><div className="article-note"><strong>{es ? "Importante" : "Educational information"}</strong><p>{es ? "Esta guía ofrece información general, no asesoría legal, fiscal, contable, financiera o de inversión. Confirma decisiones importantes con profesionales calificados." : "This guide provides general educational information—not legal, tax, accounting, financial, or investment advice. Confirm material decisions with qualified professionals."}</p></div>{guide.sections.map((section, index) => <section id={`section-${index + 1}`} key={section.heading}><span>0{index + 1}</span><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}
          <section className="article-sources"><h2>{es ? "Fuentes confiables" : "Primary sources and further reading"}</h2><p>{es ? "Consulta siempre los requisitos actuales directamente con la agencia o profesional correspondiente." : "Always confirm current requirements directly with the relevant agency, lender, or professional."}</p><ul>{guide.sources.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul></section>
          <div className="article-next"><p>{es ? "LISTO PARA APLICARLO" : "PUT THE GUIDE TO WORK"}</p><h2>{es ? "Organiza tu próxima adquisición en Crestview." : "Organize your next acquisition in Crestview."}</h2><div><Link className="button button--primary" href={`/${locale}/listings`}>{es ? "Explorar anuncios" : "Browse listings"} →</Link><Link className="button button--light" href={`/${locale}/guides/tools`}>{es ? "Usar herramientas" : "Use free tools"}</Link></div></div>
        </article>
      </div>
      <section className="section related-guides"><div className="shell"><p className="eyebrow">{es ? "SIGUE APRENDIENDO" : "KEEP LEARNING"}</p><h2>{es ? "Próximas guías recomendadas" : "Recommended next guides"}</h2><div>{related.map((item) => item && <Link href={`/${locale}/guides/${item.slug}`} key={item.slug}><span>{item.searchIntent}</span><strong>{item.shortTitle}</strong><small>{item.readTime} →</small></Link>)}</div></div></section>
    </main>
    <MarketingFooter locale={locale} />
  </>;
}
