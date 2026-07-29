import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { addEmployeeRecord, createEmployee, importEmployees } from "./actions";

type EmployeeRecord = {
  id: string;
  record_type: string;
  title: string;
  status: string;
  expires_on: string | null;
  hours: number | null;
};

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  position: string | null;
  department: string | null;
  manager_name: string | null;
  start_date: string | null;
  employment_status: string;
  preferred_locale: string;
  employee_records: EmployeeRecord[];
};

function daysUntil(value: string) {
  return Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86_400_000);
}

export default async function WorkforcePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  let employees: Employee[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("employees")
        .select("id,full_name,email,position,department,manager_name,start_date,employment_status,preferred_locale,employee_records(id,record_type,title,status,expires_on,hours)")
        .eq("user_id", user.id)
        .order("full_name");
      employees = (data ?? []) as Employee[];
    }
  }

  const activeEmployees = employees.filter((employee) => employee.employment_status === "active").length;
  const records = employees.flatMap((employee) => employee.employee_records);
  const expiringRecords = records.filter((record) => record.expires_on && daysUntil(record.expires_on) >= 0 && daysUntil(record.expires_on) <= 60);
  const trainingHours = records
    .filter((record) => record.record_type === "training")
    .reduce((total, record) => total + (record.hours ?? 0), 0);
  const pendingPto = records.filter((record) => record.record_type === "pto" && record.status !== "completed").length;
  const departments = new Set(employees.map((employee) => employee.department).filter(Boolean)).size;

  return (
    <PlatformShell locale={locale} active="workforce">
      <div className="dashboard-content">
        <PageHeading
          eyebrow={es ? "Centro de personal" : "People operations"}
          title={es ? "Personal" : "Workforce"}
          body={es ? "Perfiles, incorporación, capacitación, certificaciones y tiempo libre en un solo lugar." : "Employee profiles, onboarding, training, certifications, and time off in one organized workspace."}
          action={<Link className="button button--light" href="/api/export/employees">{es ? "Exportar empleados" : "Export employees"}</Link>}
        />

        <section className="workforce-summary" aria-label={es ? "Resumen del personal" : "Workforce summary"}>
          <article><span>{es ? "Empleados activos" : "Active employees"}</span><strong>{activeEmployees}</strong><small>{departments} {es ? "departamentos" : "departments"}</small></article>
          <article><span>{es ? "Vence pronto" : "Expiring soon"}</span><strong>{expiringRecords.length}</strong><small>{es ? "próximos 60 días" : "next 60 days"}</small></article>
          <article><span>{es ? "Horas de capacitación" : "Training hours"}</span><strong>{trainingHours}</strong><small>{es ? "registradas" : "recorded"}</small></article>
          <article><span>{es ? "Solicitudes de tiempo libre" : "Time-off requests"}</span><strong>{pendingPto}</strong><small>{es ? "pendientes" : "pending"}</small></article>
        </section>

        {expiringRecords.length > 0 && (
          <section className="workforce-alerts">
            <div><strong>{es ? "Necesita atención" : "Needs attention"}</strong><span>{es ? "Certificaciones o documentos próximos a vencer." : "Certifications or documents nearing expiration."}</span></div>
            <ul>{expiringRecords.slice(0, 5).map((record) => <li key={record.id}>{record.title}<span>{record.expires_on}</span></li>)}</ul>
          </section>
        )}

        <details className="workforce-add" open={!employees.length}>
          <summary>{es ? "Agregar o importar empleados" : "Add or import employees"}<span>{es ? "Abrir herramientas" : "Open tools"}</span></summary>
          <div>
            <form className="task-create employee-create" action={createEmployee}>
              <input type="hidden" name="locale" value={locale} />
              <label>{es ? "Nombre completo" : "Full name"}<input required name="full_name" /></label>
              <label>Email<input type="email" name="email" /></label>
              <label>{es ? "Puesto" : "Position"}<input name="position" /></label>
              <label>{es ? "Departamento" : "Department"}<input name="department" /></label>
              <label>{es ? "Gerente" : "Manager"}<input name="manager_name" /></label>
              <label>{es ? "Fecha de inicio" : "Start date"}<input type="date" name="start_date" /></label>
              <label>{es ? "Idioma" : "Language"}<select name="preferred_locale"><option value="en">English</option><option value="es">Español</option></select></label>
              <button className="button button--primary">{es ? "Agregar empleado" : "Add employee"}</button>
            </form>
            <form className="csv-import" action={importEmployees}>
              <input type="hidden" name="locale" value={locale} />
              <div><strong>{es ? "Importar empleados desde CSV" : "Import employees from CSV"}</strong><span>{es ? "Hasta 500 empleados por archivo." : "Up to 500 employees per file."}</span></div>
              <input required type="file" name="file" accept=".csv" />
              <button className="button button--light">{es ? "Importar CSV" : "Import CSV"}</button>
            </form>
          </div>
        </details>

        <div className="workforce-section-heading">
          <div><span>{es ? "Directorio" : "Team directory"}</span><h2>{es ? "Perfiles y registros" : "Profiles and records"}</h2></div>
          <p>{employees.length} {employees.length === 1 ? (es ? "persona" : "person") : (es ? "personas" : "people")}</p>
        </div>

        <div className="employee-grid">
          {employees.map((employee) => {
            const employeeExpiring = employee.employee_records.filter((record) => record.expires_on && daysUntil(record.expires_on) >= 0 && daysUntil(record.expires_on) <= 60);
            return (
              <article className="panel employee-card" key={employee.id}>
                <div className="employee-card__identity">
                  <span>{employee.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                  <div><small>{employee.department ?? (es ? "Sin departamento" : "No department")}</small><h2>{employee.full_name}</h2><p>{employee.position ?? (es ? "Puesto no indicado" : "Position not provided")}</p></div>
                  <strong className={`employee-status employee-status--${employee.employment_status}`}>{employee.employment_status}</strong>
                </div>
                <dl className="employee-details">
                  <div><dt>Email</dt><dd>{employee.email ?? "—"}</dd></div>
                  <div><dt>{es ? "Gerente" : "Manager"}</dt><dd>{employee.manager_name ?? "—"}</dd></div>
                  <div><dt>{es ? "Inicio" : "Started"}</dt><dd>{employee.start_date ?? "—"}</dd></div>
                  <div><dt>{es ? "Registros" : "Records"}</dt><dd>{employee.employee_records.length}</dd></div>
                </dl>
                {employeeExpiring.length > 0 && <p className="employee-warning">{employeeExpiring.length} {es ? "registro vence en 60 días" : "record expires within 60 days"}</p>}
                <div className="employee-records">
                  {employee.employee_records.map((record) => (
                    <div key={record.id}><span>{record.record_type}</span><strong>{record.title}</strong><small>{record.expires_on ? `${es ? "Vence" : "Expires"} ${record.expires_on}` : record.hours ? `${record.hours} ${es ? "horas" : "hours"}` : record.status}</small></div>
                  ))}
                  {!employee.employee_records.length && <p className="panel-empty">{es ? "Aún no hay registros." : "No records yet."}</p>}
                </div>
                <details className="employee-record-tools">
                  <summary>{es ? "Agregar registro" : "Add record"}</summary>
                  <form className="inline-create employee-record-create" action={addEmployeeRecord}>
                    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="employee_id" value={employee.id} />
                    <select name="record_type"><option value="certification">{es ? "Certificación" : "Certification"}</option><option value="training">{es ? "Capacitación" : "Training"}</option><option value="pto">{es ? "Tiempo libre" : "Time off"}</option><option value="document">{es ? "Documento" : "Document"}</option></select>
                    <input required name="title" placeholder={es ? "Título o solicitud" : "Title or request"} />
                    <input type="number" min="0" step=".5" name="hours" placeholder={es ? "Horas" : "Hours"} />
                    <input type="date" name="expires_on" aria-label={es ? "Vencimiento" : "Expiration"} />
                    <button>{es ? "Agregar" : "Add"}</button>
                  </form>
                </details>
              </article>
            );
          })}
          {!employees.length && <div className="empty-state"><h2>{es ? "Agrega tu primer empleado" : "Build your team directory"}</h2><p>{es ? "Agrega una persona o importa un CSV. Después podrás registrar capacitación, documentos, certificaciones y tiempo libre." : "Add one person or import a CSV. Then track training, documents, certifications, and time off from each profile."}</p></div>}
        </div>
      </div>
    </PlatformShell>
  );
}
