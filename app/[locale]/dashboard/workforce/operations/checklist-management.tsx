import { workforceOperation } from "./actions";

export type ChecklistTemplate = {id:string;title:string;category:string;items:string[];version:number;archived:boolean};
type Person = {id:string;full_name:string};
type Account = {user_id:string;role:string};
type Context = {locale:string;owner:string;accounts:Account[]};
const categories = ["onboarding","offboarding","training","renewal","policy"];

function Identity({locale,owner,operation,id}:{locale:string;owner:string;operation:string;id?:string}) {
  return <><input type="hidden" name="locale" value={locale}/><input type="hidden" name="owner" value={owner}/><input type="hidden" name="operation" value={operation}/>{id&&<input type="hidden" name="id" value={id}/>}</>;
}
function Assignee({locale,owner,accounts,value}:{value?:string}&Context) {
  return <label>{locale==="es"?"Cuenta responsable":"Responsible account"}<select name="assignee" defaultValue={value??owner} required><option value={owner}>{locale==="es"?"Propietario":"Owner"}</option>{accounts.map(a=><option key={a.user_id} value={a.user_id}>{a.role} · {a.user_id.slice(0,8)}</option>)}</select></label>;
}
export function TaskReschedule({task,...context}:{task:{id:string;version:number;assignee_id:string;due_on:string}}&Context) {
  const t=(en:string,es:string)=>context.locale==="es"?es:en;
  return <details><summary>{t("Reassign or reschedule","Reasignar o cambiar fecha")}</summary><form action={workforceOperation}>
    <Identity {...context} operation="reschedule" id={task.id}/><input type="hidden" name="version" value={task.version}/>
    <Assignee {...context} value={task.assignee_id}/><label>{t("Due date","Fecha límite")}<input name="due" type="date" defaultValue={task.due_on} required/></label>
    <label>{t("Reason for change (no sensitive data)","Motivo del cambio (sin datos sensibles)")}<input name="reason" maxLength={1000} required/></label><button>{t("Update task","Actualizar tarea")}</button>
  </form></details>;
}
export function ChecklistManagement({templates,employees,admin,...context}:{templates:ChecklistTemplate[];employees:Person[];admin:boolean}&Context) {
  const t=(en:string,es:string)=>context.locale==="es"?es:en;
  const editor=(template?:ChecklistTemplate)=><form action={workforceOperation}>
    <Identity {...context} operation="template" id={template?.id}/><input type="hidden" name="version" value={template?.version??0}/>
    <label>{t("Checklist name","Nombre de la lista")}<input name="title" defaultValue={template?.title} maxLength={200} required/></label>
    <label>{t("Category","Categoría")}<select name="category" defaultValue={template?.category??"onboarding"}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>{t("Tasks (one per line, maximum 30)","Tareas (una por línea, máximo 30)")}<textarea name="items" defaultValue={template?.items.join("\n")} maxLength={9030} rows={5} required/></label>
    <label>{t("Availability","Disponibilidad")}<select name="archived" defaultValue={String(template?.archived??false)}><option value="false">{t("Available","Disponible")}</option><option value="true">{t("Archived","Archivada")}</option></select></label>
    <button>{t("Save checklist","Guardar lista")}</button>
  </form>;
  return <section className="panel"><h2>{t("Reusable checklists","Listas reutilizables")}</h2>
    <p>{t("Create your own task lists. Edits affect future assignments only; existing tasks keep their original titles. Each assignment is all-or-nothing. Do not put private employee information in templates.","Crea tus propias listas. Los cambios afectan solo asignaciones futuras; las tareas existentes conservan sus títulos. Cada asignación es completa o no se realiza. No incluyas información privada de empleados.")}</p>
    {!templates.length&&<p>{t("No custom checklists yet.","Aún no hay listas personalizadas.")}</p>}
    {templates.filter(r=>admin||!r.archived).map(r=><article className="wf-item" key={r.id}><h3>{r.title} · {t("Version","Versión")} {r.version} {r.archived?t("· Archived","· Archivada"):""}</h3><ol>{r.items.map((item,i)=><li key={i}>{item}</li>)}</ol>
      {!r.archived&&employees.length>0&&<form action={workforceOperation}><Identity {...context} operation="assign_template" id={r.id}/><input type="hidden" name="version" value={r.version}/>
        <label>{t("Employee","Empleado")}<select name="employee" required>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label><Assignee {...context}/>
        <label>{t("Due date","Fecha límite")}<input name="due" type="date" required/></label><button>{t("Assign checklist","Asignar lista")}</button>
      </form>}
      {admin&&<details><summary>{t("Edit or archive checklist","Editar o archivar lista")}</summary>{editor(r)}</details>}
    </article>)}
    {admin&&<details><summary>{t("Create reusable checklist","Crear lista reutilizable")}</summary>{editor()}</details>}
  </section>;
}
