import { notFound } from "next/navigation";
import "./workforce.css";
import Link from "next/link";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { EmployeeImport } from "./import-preview";
import { needsAttention, pendingTimeOff } from "@/lib/workforce";
import { addEmployeeRecord, createEmployee, updateTimeOff } from "./actions";

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

export default async function WorkforcePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  let employees: Employee[] = [];
  let loadFailed = !isSupabaseConfigured();
  const { notice } = await searchParams;
  const messages: Record<string, string> = {
    saved: es ? "Cambios guardados." : "Changes saved.",
    imported: es ? "Empleados importados." : "Employees imported.",
    failed: es ? "No se guardaron los cambios. Inténtalo de nuevo." : "Changes were not saved. Please try again.",
    invalid: es ? "Revisa los campos, las fechas y las horas." : "Check the required fields, dates, and hours.",
    csv: es ? "CSV inválido: máximo 500 filas y 750 KB. Revisa los encabezados y los datos." : "Invalid CSV: maximum 500 rows and 750 KB. Check the headers and data.",
  };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("employees")
        .select("id,full_name,email,position,department,manager_name,start_date,employment_status,preferred_locale,employee_records(id,record_type,title,status,expires_on,hours)")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("full_name");
      loadFailed = !!error;
      employees = (data ?? []) as Employee[];
    }
  }

  const activeEmployees = employees.filter((employee) => employee.employment_status === "active").length;
  const records = employees.flatMap((employee) => employee.employee_records);
  const expiringRecords = employees.flatMap(employee => employee.employee_records.map(record => ({ ...record, employeeName: employee.full_name }))).filter(record => needsAttention(record)).sort((a, b) => (a.expires_on ?? "").localeCompare(b.expires_on ?? ""));
  const trainingHours = records
    .filter((record) => record.record_type === "training")
    .reduce((total, record) => total + (record.hours ?? 0), 0);
  const pendingPto = records.filter(pendingTimeOff).length;
  const departments = new Set(employees.map((employee) => employee.department).filter(Boolean)).size;

  return (
    <PlatformShell locale={locale} active="workforce">
      <div className="dashboard-content">
        <PageHeading
          eyebrow={es ? "Centro de personal" : "People operations"}
          title={es ? "Personal" : "Workforce"}
          body={es ? "Perfiles, incorporación, capacitación, certificaciones y tiempo libre en un solo lugar." : "Employee profiles, onboarding, training, certifications, and time off in one organized workspace."}
          action={<Link className="button button--light" href={`/${locale}/dashboard/workforce/operations`}>{es ? "Centro de operaciones" : "Command center"}</Link>}
        />

        {notice && messages[notice] && <p role={["failed", "invalid", "csv"].includes(notice) ? "alert" : "status"} className="workforce-alerts">{messages[notice]}</p>}
        {loadFailed && <p role="alert">{es ? "No se pudo cargar el personal. Actualiza la página para volver a intentar." : "Workforce data could not be loaded. Refresh the page to try again."}</p>}
        <section className="workforce-summary" aria-label={es ? "Resumen del personal" : "Workforce summary"}>
          <article><span>{es ? "Empleados activos" : "Active employees"}</span><strong>{activeEmployees}</strong><small>{departments} {es ? "departamentos" : "departments"}</small></article>
          <article><span>{es ? "Necesita atención" : "Needs attention"}</span><strong>{expiringRecords.length}</strong><small>{es ? "vencidos o próximos 60 días" : "expired or due within 60 days"}</small></article>
          <article><span>{es ? "Horas de capacitación" : "Training hours"}</span><strong>{trainingHours}</strong><small>{es ? "registradas" : "recorded"}</small></article>
          <article><span>{es ? "Solicitudes de tiempo libre" : "Time-off requests"}</span><strong>{pendingPto}</strong><small>{es ? "pendientes" : "pending"}</small></article>
        </section>

        {expiringRecords.length > 0 && (
          <section className="workforce-alerts">
            <div><strong>{es ? "Necesita atención" : "Needs attention"}</strong><span>{es ? "Certificaciones o documentos vencidos o próximos a vencer." : "Expired certifications and documents, or those due within 60 days."}</span></div>
            <ul>{expiringRecords.map((record) => <li key={record.id}>{record.employeeName}: {record.title}<span>{record.expires_on}</span></li>)}</ul>
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
            <EmployeeImport locale={locale}/>
          </div>
        </details>

        <div className="workforce-section-heading">
          <div><span>{es ? "Directorio" : "Team directory"}</span><h2>{es ? "Perfiles y registros" : "Profiles and records"}</h2></div>
          <p>{employees.length} {employees.length === 1 ? (es ? "persona" : "person") : (es ? "personas" : "people")}</p>
        </div>

        <div className="employee-grid">
          {employees.map((employee) => {
            const employeeExpiring = employee.employee_records.filter(record => needsAttention(record));
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
                {employeeExpiring.length > 0 && <p className="employee-warning">{employeeExpiring.length} {es ? "registros necesitan atención" : "records need attention"}</p>}
                <div className="employee-records">
                  {employee.employee_records.map((record) => (
                    <div key={record.id}><span>{record.record_type}</span><strong>{record.title}</strong><small>{record.expires_on ? `${es ? "Vence" : "Expires"} ${record.expires_on}` : record.hours ? `${record.hours} ${es ? "horas" : "hours"}` : record.status}</small>
                      {record.record_type === "pto" && <small>{es ? "Estado" : "Status"}: {record.status}</small>}
                      {pendingTimeOff(record) && <form action={updateTimeOff} aria-label={`${es ? "Revisar" : "Review"}: ${record.title}`}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="record_id" value={record.id} />
                        <button className="button button--light" name="status" value="approved">{es ? "Aprobar" : "Approve"}</button>
                        <button className="button button--light" name="status" value="rejected">{es ? "Rechazar" : "Decline"}</button>
                      </form>}
                    </div>
                  ))}
                  {!employee.employee_records.length && <p className="panel-empty">{es ? "Aún no hay registros." : "No records yet."}</p>}
                </div>
                <details className="employee-record-tools">
                  <summary>{es ? "Agregar registro" : "Add record"}</summary>
                  <form className="inline-create employee-record-create" action={addEmployeeRecord}>
                    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="employee_id" value={employee.id} />
                    <label>{es ? "Tipo de registro" : "Record type"}<select name="record_type"><option value="certification">{es ? "Certificación" : "Certification"}</option><option value="training">{es ? "Capacitación" : "Training"}</option><option value="pto">{es ? "Tiempo libre" : "Time off"}</option><option value="document">{es ? "Documento" : "Document"}</option></select></label>
                    <label>{es ? "Título o solicitud" : "Title or request"}<input required name="title" maxLength={500} /></label>
                    <label>{es ? "Horas" : "Hours"}<input type="number" min="0" step=".5" name="hours" /></label>
                    <label>{es ? "Vencimiento" : "Expiration"}<input type="date" name="expires_on" /></label>
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
