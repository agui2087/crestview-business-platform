import { notFound } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";

export default async function WorkforcePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const es = locale === "es";
  return <PlatformShell locale={locale} active="workforce"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Producto dos" : "Product two"} title={es ? "Personal" : "Workforce"} body={es ? "Un espacio bilingüe para administrar empleados de negocios adquiridos." : "A bilingual employee administration workspace for acquired businesses."} action={<button className="button button--primary" disabled>{es ? "Agregar empleado" : "Add employee"}</button>} />
    <div className="workforce-grid">{(es ? [["Empleados","Perfiles, puestos, departamentos, gerentes y estado laboral."],["Documentos","Registros con acceso controlado y seguimiento de vencimientos."],["Capacitación","Certificaciones, cursos y recordatorios de renovación."],["Tiempo libre","Solicitudes, aprobaciones y saldos registrados."]] : [["Employees","Profiles, positions, departments, managers, and employment status."],["Documents","Employee records with controlled access and expiration tracking."],["Training","Certifications, courses, and renewal reminders."],["PTO","Requests, approvals, and ledger backed balances."]]).map(([title,body]) => <article className="feature-tile" key={title}><span>{es ? "Módulo planificado" : "Planned module"}</span><h2>{title}</h2><p>{body}</p></article>)}</div>
  </div></PlatformShell>;
}
