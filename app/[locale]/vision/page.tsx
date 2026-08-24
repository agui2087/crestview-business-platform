import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "/vision", {
    title: "Our vision",
  });
}

export default async function VisionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const principles = es ? [
    ["Claridad antes que complejidad", "Las personas deben entender el proceso incluso si nunca han comprado un negocio."],
    ["Evidencia antes que promesas", "Los datos fuente, los vacíos de información y el análisis permanecen separados y visibles."],
    ["Conexión antes que fragmentación", "Compradores, corredores, documentos y próximos pasos pertenecen a un solo espacio seguro."],
  ] : [
    ["Clarity before complexity", "People should understand the process even if they have never purchased a business before."],
    ["Evidence before promises", "Source facts, missing information, and analysis remain separate and visible."],
    ["Connection before fragmentation", "Buyers, brokers, documents, and next steps belong in one secure workspace."],
  ];
  return <><MarketingHeader locale={locale} /><main>
    <section className="marketing-page-hero vision-hero"><div className="shell"><p className="eyebrow">{es ? "Nuestra visión" : "Our vision"}</p><h1>{es ? "La propiedad de negocios debería ser más accesible, clara y conectada." : "Business ownership should be more accessible, understandable, and connected."}</h1><p>{es ? "Crestview existe para ayudar a más personas a encontrar, evaluar, adquirir y operar buenos negocios sin perderse en herramientas y procesos desconectados." : "Crestview exists to help more people find, evaluate, acquire, and operate good businesses without getting lost in disconnected tools and processes."}</p></div></section>
    <section className="section"><div className="shell vision-principles">{principles.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{body}</p></article>)}</div></section>
    <section className="section section--dark"><div className="shell vision-statement"><p className="eyebrow eyebrow--lime">{es ? "El futuro que estamos construyendo" : "The future we are building"}</p><h2>{es ? "Un solo lugar para pasar de una oportunidad a una empresa bien operada." : "One place to move from opportunity to a well-run company."}</h2><p>{es ? "Comenzamos con búsqueda, diligencia y comunicación segura. Con el tiempo, Crestview conectará esas decisiones con las herramientas diarias que ayudan a los propietarios y sus equipos a prosperar." : "We begin with discovery, diligence, and secure communication. Over time, Crestview will connect those decisions to the everyday tools that help owners and their teams thrive."}</p><Link className="button button--primary" href={`/${locale}/create-account`}>{es ? "Únete a Crestview" : "Join Crestview"} →</Link></div></section>
  </main><MarketingFooter locale={locale} /></>;
}
