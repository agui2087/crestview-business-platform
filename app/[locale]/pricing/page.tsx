import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Plans and pricing" };

export default async function PricingPage({ params }: { params: Promise<{ locale:string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const other = es ? "en" : "es";
  const plans = [
    {
      name: es ? "Crestview Adquisiciones" : "Crestview Acquisition",
      price: 49,
      description: es ? "Para compradores que buscan, evalúan y adquieren negocios." : "For buyers finding, evaluating, and acquiring businesses.",
      features: es ? ["Búsqueda y comparación de oportunidades","Puntajes explicables","Proceso y listas de adquisición","Diligencia, documentos y tareas","Informes de adquisición"] : ["Opportunity search and comparison","Explainable deal scores","Acquisition pipeline and checklists","Diligence, documents, and tasks","Acquisition reporting"],
      accent: false,
    },
    {
      name: es ? "Crestview Personal" : "Crestview Workforce",
      price: 39,
      description: es ? "Para pequeñas empresas que necesitan administración de personal sencilla." : "For small businesses that need straightforward workforce administration.",
      features: es ? ["Perfiles de empleados","Departamentos y gerentes","Capacitación y certificaciones","Registros de tiempo libre","Experiencia bilingüe"] : ["Employee profiles","Departments and managers","Training and certifications","Time-off records","Bilingual employee experience"],
      accent: false,
    },
    {
      name: es ? "Crestview Completo" : "Crestview Complete",
      price: 69,
      description: es ? "Todo el ciclo, desde encontrar un negocio hasta administrarlo." : "The complete ownership system, from finding a business to operating it.",
      features: es ? ["Todo en Adquisiciones","Todo en Personal","Un solo inicio de sesión","Datos e informes conectados","Ahorra $19 al mes"] : ["Everything in Acquisition","Everything in Workforce","One connected account","Shared data and reporting","Save $19 every month"],
      accent: true,
    },
  ];
  return <>
    <header className="site-header"><div className="shell site-header__inner">
      <Brand locale={locale}/>
      <nav className="nav" aria-label="Pricing navigation"><Link href={`/${locale}`}>{es ? "Inicio" : "Home"}</Link><strong>{es ? "Planes" : "Plans"}</strong></nav>
      <div className="header-actions"><Link className="locale-link" href={`/${other}/pricing`}>{other.toUpperCase()}</Link><Link className="button button--light" href={`/${locale}/sign-in`}>{es ? "Iniciar sesión" : "Sign in"}</Link></div>
    </div></header>
    <main className="pricing-page">
      <section className="pricing-hero shell">
        <p className="eyebrow">{es ? "Planes sencillos" : "Simple plans"}</p>
        <h1>{es ? "Elige la plataforma que necesitas hoy." : "Choose the platform you need today."}</h1>
        <p>{es ? "Empieza con adquisiciones, personal o combina ambos. Cambia de plan cuando tu negocio crezca." : "Start with acquisition tools, workforce tools, or combine both. Change your plan as your business grows."}</p>
        <div className="billing-note"><strong>{es ? "Precios preliminares" : "Early pricing"}</strong><span>{es ? "La facturación se activará cuando Stripe esté conectado. No se te cobrará al crear una cuenta hoy." : "Billing will activate after Stripe is connected. Creating an account today will not charge you."}</span></div>
      </section>
      <section className="shell pricing-grid">
        {plans.map((plan)=><article className={`pricing-card ${plan.accent ? "pricing-card--featured" : ""}`} key={plan.name}>
          {plan.accent && <span className="pricing-badge">{es ? "Mejor valor" : "Best value"}</span>}
          <h2>{plan.name}</h2><p>{plan.description}</p>
          <div className="plan-price"><strong>${plan.price}</strong><span>/{es ? "mes" : "month"}</span></div>
          <Link className={`button ${plan.accent ? "button--primary" : "button--light"}`} href={`/${locale}/create-account?plan=${plan.accent ? "complete" : plan.price === 49 ? "acquisition" : "workforce"}`}>{es ? "Elegir este plan" : "Choose this plan"}</Link>
          <ul>{plan.features.map((feature)=><li key={feature}><span>✓</span>{feature}</li>)}</ul>
        </article>)}
      </section>
      <section className="shell pricing-faq"><h2>{es ? "Sin sorpresas" : "No surprises"}</h2><div><article><h3>{es ? "¿Puedo cambiar después?" : "Can I switch later?"}</h3><p>{es ? "Sí. Podrás actualizar, bajar o combinar productos desde Configuración." : "Yes. You will be able to upgrade, downgrade, or combine products from Settings."}</p></article><article><h3>{es ? "¿Me cobrarán ahora?" : "Will I be charged now?"}</h3><p>{es ? "No. Los botones crean una cuenta, pero los cobros permanecerán desactivados hasta conectar Stripe." : "No. The buttons create an account, but charges remain disabled until Stripe is connected."}</p></article><article><h3>{es ? "¿Los datos están separados?" : "Is my data separated?"}</h3><p>{es ? "Cada cuenta solo puede acceder a sus propios negocios, archivos y registros de empleados." : "Each account can access only its own deals, files, and workforce records."}</p></article></div></section>
    </main>
    <footer className="footer"><div className="shell footer__inner"><Brand locale={locale}/><span>{es ? "Una plataforma para propietarios con visión." : "A platform for thoughtful business owners."}</span><span>© 2026 Crestview</span></div></footer>
  </>;
}
