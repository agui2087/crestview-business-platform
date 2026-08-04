import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { getDictionary, isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "How Crestview works" };

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getDictionary(locale);
  const es = locale === "es";
  return <><MarketingHeader locale={locale} /><main>
    <section className="marketing-page-hero"><div className="shell">
      <p className="eyebrow">{copy.home.processLabel}</p>
      <h1>{es ? "De una búsqueda a una decisión segura." : "From a search to a confident decision."}</h1>
      <p>{es ? "Crestview organiza cada paso para que sepas qué hacer, qué falta y quién debe responder." : "Crestview organizes every step so you know what to do, what is missing, and who needs to respond."}</p>
      <div className="hero__actions"><Link className="button button--primary" href={`/${locale}/listings`}>{es ? "Ver anuncios" : "Browse listings"} →</Link><Link className="button button--light" href={`/${locale}/create-account`}>{es ? "Crear cuenta" : "Create an account"}</Link></div>
    </div></section>
    <section className="section section--dark"><div className="shell"><div className="section-heading"><div><p className="eyebrow eyebrow--lime">{copy.home.processLabel}</p><h2>{copy.home.processTitle}</h2></div><p>{copy.home.processBody}</p></div><div className="process-grid">{copy.home.steps.map(([title, body], index) => <article className="process-step" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
    <section className="section"><div className="shell journey-grid">
      <article><span>01</span><h2>{es ? "Explora sin perder contexto" : "Explore without losing context"}</h2><p>{es ? "Compara ubicación, precio, ingresos, flujo de caja y origen de cada anuncio en una vista clara." : "Compare location, price, revenue, cash flow, and listing source in one clear view."}</p></article>
      <article><span>02</span><h2>{es ? "Solicita información de forma segura" : "Request information securely"}</h2><p>{es ? "Revisa y firma el NDA antes de solicitar estados financieros. El corredor controla el acceso confidencial." : "Review and sign the NDA before requesting financial records. The broker remains in control of confidential access."}</p></article>
      <article><span>03</span><h2>{es ? "Avanza con un plan" : "Move forward with a plan"}</h2><p>{es ? "Tu lista de verificación, documentos, tareas y conversaciones permanecen conectados al negocio correcto." : "Your checklist, documents, tasks, and conversations stay connected to the right deal."}</p></article>
    </div></section>
    <section className="section section--compact"><div className="shell"><div className="cta-panel"><h2>{es ? "Encuentra un negocio y comienza con un próximo paso claro." : "Find a business and start with one clear next step."}</h2><Link className="button button--primary" href={`/${locale}/listings`}>{es ? "Explorar anuncios" : "Explore listings"} →</Link></div></div></section>
  </main><MarketingFooter locale={locale} /></>;
}
