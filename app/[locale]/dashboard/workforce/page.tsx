import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { addEmployeeRecord, createEmployee, importEmployees } from "./actions";

type Employee = { id:string; full_name:string; email:string|null; position:string|null; department:string|null; manager_name:string|null; start_date:string|null; employment_status:string; preferred_locale:string; employee_records:Array<{id:string;record_type:string;title:string;status:string;expires_on:string|null;hours:number|null}> };

export default async function WorkforcePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const es = locale === "es";
  let employees: Employee[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("employees").select("id,full_name,email,position,department,manager_name,start_date,employment_status,preferred_locale,employee_records(id,record_type,title,status,expires_on,hours)").eq("user_id", user.id).order("full_name");
      employees = (data ?? []) as Employee[];
    }
  }
  return <PlatformShell locale={locale} active="workforce"><div className="dashboard-content">
    <PageHeading eyebrow={es ? "Administración de personal" : "Workforce administration"} title={es ? "Personal" : "Workforce"} body={es ? "Administra empleados, capacitación, certificaciones y tiempo libre." : "Manage employees, training, certifications, and time-off records."} action={<Link className="button button--light" href="/api/export/employees">{es ? "Exportar empleados" : "Export employees"}</Link>} />
    <form className="task-create employee-create" action={createEmployee}>
      <input type="hidden" name="locale" value={locale}/>
      <label>{es ? "Nombre completo" : "Full name"}<input required name="full_name"/></label>
      <label>Email<input type="email" name="email"/></label>
      <label>{es ? "Puesto" : "Position"}<input name="position"/></label>
      <label>{es ? "Departamento" : "Department"}<input name="department"/></label>
      <label>{es ? "Gerente" : "Manager"}<input name="manager_name"/></label>
      <label>{es ? "Fecha de inicio" : "Start date"}<input type="date" name="start_date"/></label>
      <label>{es ? "Idioma" : "Language"}<select name="preferred_locale"><option value="en">English</option><option value="es">Español</option></select></label>
      <button className="button button--primary">{es ? "Agregar empleado" : "Add employee"}</button>
    </form>
    <form className="csv-import" action={importEmployees}>
      <input type="hidden" name="locale" value={locale}/>
      <div><strong>{es ? "Importar empleados desde CSV" : "Import employees from CSV"}</strong><span>{es ? "Columnas: full_name, email, position, department, manager_name, start_date, preferred_locale" : "Columns: full_name, email, position, department, manager_name, start_date, preferred_locale"}</span></div>
      <input required type="file" name="file" accept=".csv"/>
      <button className="button button--light">{es ? "Importar CSV" : "Import CSV"}</button>
    </form>
    <div className="employee-grid">
      {employees.map((employee) => <article className="panel employee-card" key={employee.id}>
        <div className="panel__header"><div><span>{employee.department ?? (es ? "Sin departamento" : "No department")}</span><h2>{employee.full_name}</h2></div><strong>{employee.employment_status}</strong></div>
        <p>{employee.position ?? (es ? "Puesto no indicado" : "Position not provided")} · {employee.email ?? (es ? "Sin email" : "No email")}</p>
        <div className="employee-records">{employee.employee_records.map((record) => <div key={record.id}><span>{record.record_type}</span><strong>{record.title}</strong><small>{record.expires_on ? `${es ? "Vence" : "Expires"} ${record.expires_on}` : record.hours ? `${record.hours} ${es ? "horas" : "hours"}` : record.status}</small></div>)}</div>
        <form className="inline-create employee-record-create" action={addEmployeeRecord}>
          <input type="hidden" name="locale" value={locale}/><input type="hidden" name="employee_id" value={employee.id}/>
          <select name="record_type"><option value="certification">{es ? "Certificación" : "Certification"}</option><option value="training">{es ? "Capacitación" : "Training"}</option><option value="pto">{es ? "Tiempo libre" : "PTO"}</option></select>
          <input required name="title" placeholder={es ? "Título o solicitud" : "Title or request"}/>
          <input type="date" name="expires_on" aria-label={es ? "Vencimiento" : "Expiration"}/>
          <button>{es ? "Agregar" : "Add"}</button>
        </form>
      </article>)}
      {!employees.length && <div className="empty-state"><h2>{es ? "Agrega tu primer empleado" : "Add your first employee"}</h2><p>{es ? "Los perfiles y registros aparecerán aquí." : "Employee profiles and records will appear here."}</p></div>}
    </div>
  </div></PlatformShell>;
}
