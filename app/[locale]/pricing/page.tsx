import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Plans and pricing" };

type Plan = {
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  badge?: string;
  featured?: boolean;
};

function PlanCard({ plan, comingSoon }: { plan: Plan; comingSoon: string }) {
  return (
    <article className={`pricing-card ${plan.featured ? "pricing-card--featured" : ""}`}>
      {plan.badge && <span className="pricing-badge">{plan.badge}</span>}
      <h3>{plan.name}</h3>
      <p>{plan.description}</p>
      <div className="plan-price">
        <strong>{plan.price}</strong>
        {plan.cadence && <span>{plan.cadence}</span>}
      </div>
      <button className={`button ${plan.featured ? "button--primary" : "button--light"}`} type="button" disabled>
        {comingSoon}
      </button>
      <ul>
        {plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}
      </ul>
    </article>
  );
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const es = locale === "es";
  const other = es ? "en" : "es";
  const comingSoon = es ? "Próximamente" : "Coming soon";

  const buyerPlans: Plan[] = es ? [
    {
      name: "Crestview Gratis",
      price: "$0",
      cadence: "/siempre",
      description: "Recursos completos para pasar de la búsqueda al cierre sin pagar por el proceso esencial.",
      badge: "Para todos",
      features: ["Buscar, filtrar y guardar oportunidades", "Proceso completo de adquisición", "Listas de diligencia y recursos", "Calculadoras de valoración", "Documentos, tareas y progreso", "Borradores para contactar al corredor"],
    },
    {
      name: "Crestview Pro",
      price: "$9.99",
      cadence: "/mes",
      description: "Ayuda avanzada para entender contratos, documentos financieros y el lenguaje de M&A.",
      badge: "Ayuda avanzada",
      featured: true,
      features: ["Todo lo incluido en Gratis", "Explicaciones de contratos en lenguaje claro", "Resúmenes de documentos con IA", "Explicaciones de términos de M&A", "Señales de riesgo y preguntas sugeridas", "Análisis financiero y comparaciones avanzadas"],
    },
  ] : [
    {
      name: "Crestview Free",
      price: "$0",
      cadence: "/forever",
      description: "Complete resources for moving from discovery through closing without paying for the essential process.",
      badge: "For everyone",
      features: ["Search, filter, and save opportunities", "Complete acquisition process", "Diligence checklists and resources", "Valuation calculators", "Documents, tasks, and progress tracking", "Broker outreach drafts"],
    },
    {
      name: "Crestview Pro",
      price: "$9.99",
      cadence: "/month",
      description: "Advanced help understanding contracts, financial documents, and high-level M&A language.",
      badge: "Advanced guidance",
      featured: true,
      features: ["Everything included in Free", "Plain-English contract explanations", "AI summaries of uploaded documents", "M&A terminology explanations", "Risk flags and suggested questions", "Advanced financial analysis and comparisons"],
    },
  ];

  const brokerPlans: Plan[] = es ? [
    {
      name: "Una publicación",
      price: "$9.99",
      cadence: "una vez",
      description: "Para un vendedor o corredor ocasional con una sola publicación activa.",
      features: ["Una publicación activa", "Activa hasta venta, retiro o inactividad", "Ubicación estándar en resultados", "Confirmación de disponibilidad cada 60 días"],
    },
    {
      name: "Plan para corredores",
      price: "$25",
      cadence: "/mes",
      description: "Para corredores que necesitan administrar varias publicaciones y consultas.",
      badge: "Para profesionales",
      featured: true,
      features: ["Varias publicaciones activas", "Perfil profesional", "Bandeja de clientes potenciales", "Análisis de publicaciones", "Solicitudes de documentos y NDA"],
    },
    {
      name: "Visibilidad mejorada",
      price: "$49.99",
      cadence: "/30 días",
      description: "Más exposición para una publicación específica durante treinta días.",
      features: ["Publicación destacada", "Mejor ubicación en búsquedas relevantes", "Estilo visual destacado", "Estadísticas de promoción"],
    },
    {
      name: "Máxima visibilidad",
      price: "$99.99",
      cadence: "/30 días",
      description: "La promoción más fuerte en búsquedas, categorías y ubicaciones relevantes.",
      badge: "Mayor alcance",
      features: ["Ubicación prioritaria", "Parte superior de búsquedas apropiadas", "Promoción por categoría y ubicación", "Estadísticas avanzadas de promoción"],
    },
  ] : [
    {
      name: "Single Listing",
      price: "$9.99",
      cadence: "one time",
      description: "For an individual seller or occasional broker with one active listing.",
      features: ["One active listing", "Active until sold, withdrawn, or inactive", "Standard search placement", "Availability confirmation every 60 days"],
    },
    {
      name: "Broker Plan",
      price: "$25",
      cadence: "/month",
      description: "For brokers who need to manage multiple listings and buyer inquiries.",
      badge: "For professionals",
      featured: true,
      features: ["Multiple active listings", "Professional broker profile", "Buyer lead inbox", "Listing performance analytics", "Document and NDA requests"],
    },
    {
      name: "Enhanced Visibility",
      price: "$49.99",
      cadence: "/30 days",
      description: "Additional exposure for one specific listing for thirty days.",
      features: ["Featured listing treatment", "Higher relevant search placement", "Distinct visual highlighting", "Promotion performance statistics"],
    },
    {
      name: "Highest Visibility",
      price: "$99.99",
      cadence: "/30 days",
      description: "The strongest promotion across relevant searches, categories, and locations.",
      badge: "Maximum reach",
      features: ["Priority placement", "Top of appropriate searches", "Category and location promotion", "Advanced promotion analytics"],
    },
  ];

  const workforceTiers = es ? [
    ["1–10 empleados", "$20/mes"], ["11–25 empleados", "$40/mes"], ["26–50 empleados", "$60/mes"],
    ["51–100 empleados", "$80/mes"], ["101–200 empleados", "$100/mes"], ["201–300 empleados", "$120/mes"], ["301+ empleados", "Precio personalizado"],
  ] : [
    ["1–10 employees", "$20/month"], ["11–25 employees", "$40/month"], ["26–50 employees", "$60/month"],
    ["51–100 employees", "$80/month"], ["101–200 employees", "$100/month"], ["201–300 employees", "$120/month"], ["301+ employees", "Custom pricing"],
  ];

  return <>
    <header className="site-header"><div className="shell site-header__inner">
      <Brand locale={locale} />
      <nav className="nav" aria-label={es ? "Navegación de precios" : "Pricing navigation"}><Link href={`/${locale}`}>{es ? "Inicio" : "Home"}</Link><strong>{es ? "Planes" : "Plans"}</strong></nav>
      <div className="header-actions"><Link className="locale-link" href={`/${other}/pricing`}>{other.toUpperCase()}</Link><Link className="button button--light" href={`/${locale}/sign-in`}>{es ? "Iniciar sesión" : "Sign in"}</Link></div>
    </div></header>

    <main className="pricing-page">
      <section className="pricing-hero shell">
        <p className="eyebrow">{es ? "Precios fundadores" : "Founding prices"}</p>
        <h1>{es ? "Empieza gratis. Paga solo por la ayuda que necesitas." : "Start free. Pay only for the help you need."}</h1>
        <p>{es ? "Crestview mantiene el proceso completo de adquisición accesible. Pro agrega explicaciones avanzadas, mientras los corredores y equipos eligen herramientas según su uso." : "Crestview keeps the complete acquisition process accessible. Pro adds advanced explanations, while brokers and workforce teams choose tools based on how they use the platform."}</p>
        <div className="billing-note"><strong>{comingSoon}</strong><span>{es ? "Las suscripciones, publicaciones para corredores y promociones estarán disponibles próximamente." : "Subscriptions, broker listings, and promotional placements will be available soon."}</span></div>
      </section>

      <section className="shell pricing-section" aria-labelledby="buyer-pricing">
        <div className="pricing-section__heading"><div><p className="eyebrow">{es ? "Compradores" : "For buyers"}</p><h2 id="buyer-pricing">{es ? "La ruta completa permanece gratis." : "The complete path stays free."}</h2></div><p>{es ? "Pro mejora la comprensión. No bloquea los pasos esenciales para comprar un negocio." : "Pro improves understanding. It does not lock away the essential steps required to buy a business."}</p></div>
        <div className="pricing-grid pricing-grid--two">{buyerPlans.map((plan) => <PlanCard key={plan.name} plan={plan} comingSoon={comingSoon} />)}</div>
        <p className="pricing-disclaimer">{es ? "Las explicaciones de documentos son educativas y no sustituyen el asesoramiento de un abogado, contador u otro profesional calificado." : "Document explanations are educational and do not replace advice from a qualified attorney, accountant, or other professional."}</p>
      </section>

      <section className="pricing-band" aria-labelledby="broker-pricing"><div className="shell pricing-section">
        <div className="pricing-section__heading"><div><p className="eyebrow">{es ? "Vendedores y corredores" : "For sellers and brokers"}</p><h2 id="broker-pricing">{es ? "Publica una vez o administra una cartera." : "List once or manage a portfolio."}</h2></div><p>{es ? "Las promociones aumentan la visibilidad, pero nunca cambian la puntuación independiente de una oportunidad." : "Promotions increase visibility, but they never change an opportunity’s independent Crestview score."}</p></div>
        <div className="pricing-grid pricing-grid--four">{brokerPlans.map((plan) => <PlanCard key={plan.name} plan={plan} comingSoon={comingSoon} />)}</div>
        <p className="pricing-disclaimer">{es ? "Las publicaciones promocionadas siempre estarán identificadas claramente. Las promociones duran 30 días; la publicación base continúa según su plan." : "Promoted listings will always be clearly labeled. Promotions last 30 days; the underlying listing continues according to its plan."}</p>
      </div></section>

      <section className="shell pricing-section" aria-labelledby="workforce-pricing">
        <div className="pricing-section__heading"><div><p className="eyebrow">{es ? "Personal" : "Workforce"}</p><h2 id="workforce-pricing">{es ? "Precios que crecen con tu equipo." : "Pricing that grows with your team."}</h2></div><p>{es ? "Administración sencilla de empleados, documentos, certificaciones, capacitación y tiempo libre. El procesamiento de nómina no está incluido inicialmente." : "Straightforward employee, document, certification, training, and time-off administration. Payroll processing is not included initially."}</p></div>
        <div className="workforce-pricing">
          <div className="workforce-pricing__intro">
            <span>{es ? "Desde" : "Starting at"}</span><strong>$20</strong><small>/{es ? "mes" : "month"}</small>
            <p>{es ? "Todos los niveles incluyen la experiencia bilingüe en inglés y español." : "Every tier includes the bilingual English and Spanish experience."}</p>
            <button className="button button--primary" type="button" disabled>{comingSoon}</button>
          </div>
          <div className="workforce-tiers" role="table" aria-label={es ? "Niveles de precios de personal" : "Workforce pricing tiers"}>
            {workforceTiers.map(([size, price]) => <div role="row" key={size}><span role="cell">{size}</span><strong role="cell">{price}</strong></div>)}
          </div>
        </div>
      </section>

      <section className="shell pricing-faq"><h2>{es ? "Preguntas sobre los planes" : "Plan questions"}</h2><div>
        <article><h3>{es ? "¿Puedo usar todo el proceso gratis?" : "Can I complete the process for free?"}</h3><p>{es ? "Sí. Buscar, guardar, valorar, organizar la diligencia y avanzar por la lista de adquisición permanecerá disponible sin Pro." : "Yes. Searching, saving, valuing, organizing diligence, and moving through the acquisition checklist will remain available without Pro."}</p></article>
        <article><h3>{es ? "¿Cuándo estarán disponibles los planes pagados?" : "When will paid plans be available?"}</h3><p>{es ? "Próximamente. Mientras tanto, puedes crear una cuenta y comenzar a usar las herramientas gratuitas de Crestview." : "Coming soon. In the meantime, you can create an account and start using Crestview’s free tools."}</p></article>
        <article><h3>{es ? "¿Cuánto dura una publicación?" : "How long does a listing remain active?"}</h3><p>{es ? "Una publicación individual continúa hasta su venta, retiro o inactividad. Se pedirá confirmar su disponibilidad cada 60 días." : "A single listing continues until it is sold, withdrawn, or inactive. Availability must be confirmed every 60 days."}</p></article>
      </div></section>
    </main>

    <footer className="footer"><div className="shell footer__inner"><Brand locale={locale} /><span>{es ? "Una plataforma para propietarios con visión." : "A platform for thoughtful business owners."}</span><span>© 2026 Crestview</span></div></footer>
  </>;
}
