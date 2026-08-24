import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { chatGPTSignOutPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { isLocale } from "@/lib/i18n";
import { localizedPublicMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  return localizedPublicMetadata(locale === "es" ? "es" : "en", "/pricing", {
    title: "Plans and pricing",
  });
}

type Plan = {
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  productCode?: string;
  action?: string;
  badge?: string;
  featured?: boolean;
};

function PlanCard({
  plan,
  cta,
  href,
  locale,
}: {
  plan: Plan;
  cta: string;
  href: string;
  locale: string;
}) {
  return (
    <article className={`pricing-card ${plan.featured ? "pricing-card--featured" : ""}`}>
      {plan.badge && <span className="pricing-badge">{plan.badge}</span>}
      <h3>{plan.name}</h3>
      <p>{plan.description}</p>
      <div className="plan-price">
        <strong>{plan.price}</strong>
        {plan.cadence && <span>{plan.cadence}</span>}
      </div>
      {plan.productCode ? (
        <form className="pricing-checkout-form" action="/api/stripe/checkout" method="post">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="product_code" value={plan.productCode} />
          <button className={`button ${plan.featured ? "button--primary" : "button--light"}`} type="submit">
            {plan.action ?? cta}
          </button>
        </form>
      ) : (
        <Link className={`button ${plan.featured ? "button--primary" : "button--light"}`} href={href}>
          {cta}
        </Link>
      )}
      <ul>
        {plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}
      </ul>
    </article>
  );
}

export default async function PricingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const user = await getChatGPTUser();

  const es = locale === "es";
  const createAccount = es ? "Crear una cuenta" : "Create account";
  const createAccountHref = `/${locale}/create-account`;

  const buyerPlans: Plan[] = es ? [
    {
      name: "Crestview Gratis",
      price: "$0",
      cadence: "/siempre",
      description: "Recursos completos para pasar de la búsqueda al cierre sin pagar por el proceso esencial.",
      badge: "Para todos",
      features: ["Buscar, filtrar y guardar oportunidades", "Centro de mando y próximos pasos", "Checklist específico para cada negocio", "Pasaporte básico de confianza", "Calculadoras de valoración", "Tareas, evidencia y progreso"],
    },
    {
      name: "Crestview Pro",
      price: "$9.99",
      cadence: "/mes",
      productCode: "crestview_pro",
      action: "Elegir Pro",
      description: "Ayuda avanzada para entender contratos, documentos financieros y el lenguaje de M&A.",
      badge: "Ayuda avanzada",
      featured: true,
      features: ["Todo lo incluido en Gratis", "Calculadora Excel de diligencia financiera", "Inteligencia documental con fuentes", "Alertas por discrepancias entre documentos", "Explicaciones avanzadas de riesgos", "Comparaciones financieras avanzadas", "Estados de revisión controlados para hallazgos"],
    },
  ] : [
    {
      name: "Crestview Free",
      price: "$0",
      cadence: "/forever",
      description: "Complete resources for moving from discovery through closing without paying for the essential process.",
      badge: "For everyone",
      features: ["Search, filter, and save opportunities", "Deal command center and next steps", "Deal-specific acquisition checklist", "Basic verified listing passport", "Valuation calculators", "Tasks, evidence, and progress tracking"],
    },
    {
      name: "Crestview Pro",
      price: "$9.99",
      cadence: "/month",
      productCode: "crestview_pro",
      action: "Choose Pro",
      description: "Advanced help understanding contracts, financial documents, and high-level M&A language.",
      badge: "Advanced guidance",
      featured: true,
      features: ["Everything included in Free", "Excel financial due-diligence calculator", "Source-linked document intelligence", "Cross-document discrepancy alerts", "Detailed match explanations", "Lender package generation", "Advanced valuation scenarios", "Exportable decision reports"],
    },
  ];

  const brokerPlans: Plan[] = es ? [
    {
      name: "Una publicación",
      price: "$30",
      cadence: "una vez",
      productCode: "single_listing",
      action: "Comprar publicación",
      description: "Para un vendedor o corredor ocasional con una sola publicación activa.",
      features: ["Una publicación activa", "Activa hasta venta, retiro o inactividad", "Ubicación estándar en resultados", "Confirmación de disponibilidad cada 60 días"],
    },
    {
      name: "Plan para corredores",
      price: "$25",
      cadence: "/mes",
      productCode: "broker_plan",
      action: "Elegir plan",
      description: "Para corredores que necesitan administrar varias publicaciones y consultas.",
      badge: "Para profesionales",
      featured: true,
      features: ["Varias publicaciones activas", "Perfil profesional", "Bandeja de clientes potenciales", "Análisis de publicaciones", "Solicitudes de documentos y NDA"],
    },
    {
      name: "Visibilidad mejorada",
      price: "$49.99",
      cadence: "/30 días",
      productCode: "enhanced_visibility",
      action: "Promocionar publicación",
      description: "Más exposición para una publicación específica durante treinta días.",
      features: ["Publicación destacada", "Mejor ubicación en búsquedas relevantes", "Estilo visual destacado", "Estadísticas de promoción"],
    },
    {
      name: "Máxima visibilidad",
      price: "$99.99",
      cadence: "/30 días",
      productCode: "highest_visibility",
      action: "Obtener máxima visibilidad",
      description: "La promoción más fuerte en búsquedas, categorías y ubicaciones relevantes.",
      badge: "Mayor alcance",
      features: ["Ubicación prioritaria", "Parte superior de búsquedas apropiadas", "Promoción por categoría y ubicación", "Estadísticas avanzadas de promoción"],
    },
  ] : [
    {
      name: "Single Listing",
      price: "$30",
      cadence: "one time",
      productCode: "single_listing",
      action: "Buy listing",
      description: "For an individual seller or occasional broker with one active listing.",
      features: ["One active listing", "Active until sold, withdrawn, or inactive", "Standard search placement", "Availability confirmation every 60 days"],
    },
    {
      name: "Broker Plan",
      price: "$25",
      cadence: "/month",
      productCode: "broker_plan",
      action: "Choose plan",
      description: "For brokers who need to manage multiple listings and buyer inquiries.",
      badge: "For professionals",
      featured: true,
      features: ["Multiple active listings", "Professional broker profile", "Buyer lead inbox", "Listing performance analytics", "Document and NDA requests"],
    },
    {
      name: "Enhanced Visibility",
      price: "$49.99",
      cadence: "/30 days",
      productCode: "enhanced_visibility",
      action: "Promote listing",
      description: "Additional exposure for one specific listing for thirty days.",
      features: ["Featured listing treatment", "Higher relevant search placement", "Distinct visual highlighting", "Promotion performance statistics"],
    },
    {
      name: "Highest Visibility",
      price: "$99.99",
      cadence: "/30 days",
      productCode: "highest_visibility",
      action: "Get highest visibility",
      description: "The strongest promotion across relevant searches, categories, and locations.",
      badge: "Maximum reach",
      features: ["Priority placement", "Top of appropriate searches", "Category and location promotion", "Advanced promotion analytics"],
    },
  ];

  const workforceTiers = es ? [
    ["10 empleados", "$20/mes"], ["25 empleados", "$50/mes"], ["50 empleados", "$100/mes"],
    ["100 empleados", "$200/mes"], ["200 empleados", "$400/mes"], ["300 empleados", "$600/mes"], ["Más de 300 empleados", "Precio personalizado"],
  ] : [
    ["10 employees", "$20/month"], ["25 employees", "$50/month"], ["50 employees", "$100/month"],
    ["100 employees", "$200/month"], ["200 employees", "$400/month"], ["300 employees", "$600/month"], ["More than 300 employees", "Custom pricing"],
  ];

  return <>
    <header className="site-header"><div className="shell site-header__inner">
      <Brand locale={locale} />
      <nav className="nav" aria-label={es ? "Navegación de precios" : "Pricing navigation"}><Link href={`/${locale}`}>{es ? "Inicio" : "Home"}</Link><strong>{es ? "Planes" : "Plans"}</strong></nav>
      <div className="header-actions">
        <LocaleSwitcher locale={locale} />
        {user ? <>
          <Link className="button button--light" href={`/${locale}/dashboard`}>{es ? "Panel" : "Dashboard"}</Link>
          <form action="/api/stripe/portal" method="post">
            <input type="hidden" name="locale" value={locale} />
            <button className="button button--light" type="submit">{es ? "Administrar facturación" : "Manage billing"}</button>
          </form>
          <a className="header-signout" href={chatGPTSignOutPath(`/${locale}`)}>{es ? "Salir" : "Sign out"}</a>
        </> : <Link className="button button--light" href={`/${locale}/sign-in`}>{es ? "Iniciar sesión" : "Sign in"}</Link>}
      </div>
    </div></header>

    <main className="pricing-page">
      <section className="pricing-hero shell">
        {query.checkout === "success" && (
          <div className="billing-status billing-status--success" role="status">
            <strong>{es ? "Pago recibido" : "Payment received"}</strong>
            <span>{es ? "Stripe está confirmando el pago. Tu acceso se activará mediante la confirmación segura del servidor." : "Stripe is confirming the payment. Your access will activate through secure server confirmation."}</span>
          </div>
        )}
        {query.checkout === "canceled" && (
          <div className="billing-status" role="status">
            <strong>{es ? "Pago cancelado" : "Checkout canceled"}</strong>
            <span>{es ? "No se realizó ningún cargo. Puedes elegir un plan cuando estés listo." : "No charge was made. You can choose a plan whenever you are ready."}</span>
          </div>
        )}
        {typeof query.billing_error === "string" && (
          <div className="billing-status billing-status--error" role="alert">
            <strong>{es ? "No se pudo abrir la facturación" : "Billing could not be opened"}</strong>
            <span>{es ? "Vuelve a intentarlo o inicia sesión antes de seleccionar un plan." : "Please try again or sign in before selecting a plan."}</span>
          </div>
        )}
        <p className="eyebrow">{es ? "Precios fundadores" : "Founding prices"}</p>
        <h1>{es ? "Empieza gratis. Paga solo por la ayuda que necesitas." : "Start free. Pay only for the help you need."}</h1>
        <p>{es ? "Crestview mantiene el proceso completo de adquisición accesible. Pro agrega explicaciones avanzadas, mientras los corredores y equipos eligen herramientas según su uso." : "Crestview keeps the complete acquisition process accessible. Pro adds advanced explanations, while brokers and workforce teams choose tools based on how they use the platform."}</p>
        <div className="billing-note"><strong>{es ? "Acceso gratuito disponible" : "Free access available"}</strong><span>{es ? "Crea una cuenta para buscar oportunidades, guardar negocios y administrar tu proceso de adquisición." : "Create an account to search opportunities, save businesses, and manage your acquisition process."}</span></div>
      </section>

      <section className="shell pricing-section" aria-labelledby="buyer-pricing">
        <div className="pricing-section__heading"><div><p className="eyebrow">{es ? "Compradores" : "For buyers"}</p><h2 id="buyer-pricing">{es ? "La ruta completa permanece gratis." : "The complete path stays free."}</h2></div><p>{es ? "Pro mejora la comprensión. No bloquea los pasos esenciales para comprar un negocio." : "Pro improves understanding. It does not lock away the essential steps required to buy a business."}</p></div>
        <div className="pricing-grid pricing-grid--two">{buyerPlans.map((plan) => <PlanCard key={plan.name} plan={plan} cta={createAccount} href={createAccountHref} locale={locale} />)}</div>
        <p className="pricing-disclaimer">{es ? "Las explicaciones de documentos son educativas y no sustituyen el asesoramiento de un abogado, contador u otro profesional calificado." : "Document explanations are educational and do not replace advice from a qualified attorney, accountant, or other professional."}</p>
      </section>

      <section className="pricing-band" aria-labelledby="broker-pricing"><div className="shell pricing-section">
        <div className="pricing-section__heading"><div><p className="eyebrow">{es ? "Vendedores y corredores" : "For sellers and brokers"}</p><h2 id="broker-pricing">{es ? "Publica una vez o administra una cartera." : "List once or manage a portfolio."}</h2></div><p>{es ? "Las promociones aumentan la visibilidad, pero nunca cambian la puntuación independiente de una oportunidad." : "Promotions increase visibility, but they never change an opportunity’s independent Crestview score."}</p></div>
        <div className="pricing-grid pricing-grid--four">{brokerPlans.map((plan) => <PlanCard key={plan.name} plan={plan} cta={createAccount} href={createAccountHref} locale={locale} />)}</div>
        <p className="pricing-disclaimer">{es ? "Las publicaciones promocionadas siempre estarán identificadas claramente. Las promociones duran 30 días; la publicación base continúa según su plan." : "Promoted listings will always be clearly labeled. Promotions last 30 days; the underlying listing continues according to its plan."}</p>
      </div></section>

      <section className="shell pricing-section" aria-labelledby="workforce-pricing">
        <div className="pricing-section__heading"><div><p className="eyebrow">{es ? "Personal" : "Workforce"}</p><h2 id="workforce-pricing">{es ? "Precios que crecen con tu equipo." : "Pricing that grows with your team."}</h2></div><p>{es ? "Administración sencilla de empleados, documentos, certificaciones, capacitación y tiempo libre. El procesamiento de nómina no está incluido inicialmente." : "Straightforward employee, document, certification, training, and time-off administration. Payroll processing is not included initially."}</p></div>
        <div className="workforce-pricing">
          <div className="workforce-pricing__intro">
            <span>{es ? "Desde" : "Starting at"}</span><strong>$20</strong><small>/{es ? "mes" : "month"}</small>
            <p>{es ? "Precio equivalente a $2 por empleado al mes. Todos los niveles incluyen la experiencia bilingüe en inglés y español." : "Equivalent to $2 per employee per month. Every tier includes the bilingual English and Spanish experience."}</p>
            <form className="workforce-checkout-form" action="/api/stripe/checkout" method="post">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="product_code" value="workforce" />
              <label htmlFor="workforce-quantity">{es ? "Número de empleados" : "Employee count"}</label>
              <select id="workforce-quantity" name="quantity" defaultValue="10">
                {[10, 25, 50, 100, 200, 300].map((quantity) => (
                  <option key={quantity} value={quantity}>{quantity}</option>
                ))}
              </select>
              <button className="button button--primary" type="submit">{es ? "Elegir Workforce" : "Choose Workforce"}</button>
            </form>
          </div>
          <div className="workforce-tiers" role="table" aria-label={es ? "Niveles de precios de personal" : "Workforce pricing tiers"}>
            {workforceTiers.map(([size, price]) => <div role="row" key={size}><span role="cell">{size}</span><strong role="cell">{price}</strong></div>)}
          </div>
        </div>
      </section>

      <section className="shell pricing-faq"><h2>{es ? "Preguntas sobre los planes" : "Plan questions"}</h2><div>
        <article><h3>{es ? "¿Puedo usar todo el proceso gratis?" : "Can I complete the process for free?"}</h3><p>{es ? "Sí. Buscar, guardar, valorar, organizar la diligencia y avanzar por la lista de adquisición permanecerá disponible sin Pro." : "Yes. Searching, saving, valuing, organizing diligence, and moving through the acquisition checklist will remain available without Pro."}</p></article>
        <article><h3>{es ? "¿Puedo comenzar sin elegir un plan pagado?" : "Can I start without choosing a paid plan?"}</h3><p>{es ? "Sí. Crea una cuenta gratuita y comienza con las herramientas esenciales. Podrás elegir una mejora desde tu cuenta cuando la necesites." : "Yes. Create a free account and begin with the essential tools. You can choose an upgrade from your account when you need it."}</p></article>
        <article><h3>{es ? "¿Cuánto dura una publicación?" : "How long does a listing remain active?"}</h3><p>{es ? "Una publicación individual continúa hasta su venta, retiro o inactividad. Se pedirá confirmar su disponibilidad cada 60 días." : "A single listing continues until it is sold, withdrawn, or inactive. Availability must be confirmed every 60 days."}</p></article>
      </div></section>
    </main>

    <footer className="footer"><div className="shell footer__inner"><Brand locale={locale} /><span>{es ? "Una plataforma para propietarios con visión." : "A platform for thoughtful business owners."}</span><span>© 2026 Crestview</span></div></footer>
  </>;
}
