"use client";
import {useState} from "react";
import {defaultTaskDetails, readTaskDetails, type TaskDetails} from "@/lib/acquisition-tailoring";

export function AcquisitionTaskDetails({taskKey, label, status, raw, es, busy, documents, dealHref, onSave}: {
  taskKey:string; label:string; status:string; raw?:string; es:boolean; busy:boolean;
  documents:Array<{id:string;title:string}>; dealHref:string|null;
  onSave:(details:TaskDetails, notApplicable:boolean)=>Promise<boolean>;
}) {
  const details = readTaskDetails(raw) ?? defaultTaskDetails;
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);
  const roles = es ? {buyer:"Comprador",broker:"Corredor",lender:"Prestamista",advisor:"Asesor"} : {buyer:"Buyer",broker:"Broker",lender:"Lender",advisor:"Advisor"};
  return <details className="acquisition-task-details">
    <summary>{es ? "Responsable, fecha, evidencia o no aplica" : "Owner, deadline, evidence or not applicable"}</summary>
    <form key={raw ?? ""} onSubmit={async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const parsed = readTaskDetails(JSON.stringify(Object.fromEntries(data)));
      const notApplicable = data.get("notApplicable") === "yes";
      if (!parsed || (notApplicable && parsed.reason.length < 10)) {
        setError(es ? "Ingresa una fecha válida y una razón de al menos 10 caracteres si no aplica." : "Enter a valid date and a reason of at least 10 characters when not applicable."); return;
      }
      setSaving(true); setError("");
      try { if (!await onSave(parsed,notApplicable)) setError(es ? "No se guardó. Intenta nuevamente." : "Not saved. Please retry."); }
      finally {setSaving(false);}
    }} aria-label={es ? `Detalles: ${label}` : `Task details: ${label}`}>
      <label>{es ? "Responsable" : "Responsible role"}<select name="owner" defaultValue={details.owner}>{Object.entries(roles).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label>
      <label>{es ? "Persona responsable (opcional)" : "Responsible person (optional)"}<input name="assignee" maxLength={100} defaultValue={details.assignee}/></label>
      <label>{es ? "Fecha límite" : "Due date"}<input type="date" name="due" min="2000-01-01" max="2099-12-31" defaultValue={details.due}/></label>
      <label>{es ? "En espera de" : "Waiting on"}<select name="waiting" defaultValue={details.waiting}><option value="none">{es ? "Nadie" : "No one"}</option>{Object.entries(roles).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label>
      <label>{es ? "Documento vinculado" : "Linked document"}<select name="document" defaultValue={documents.some(d=>d.id===details.document) ? details.document : ""}><option value="">{es ? "Sin documento" : "No document linked"}</option>{documents.map(document=><option key={document.id} value={document.id}>{document.title}</option>)}</select></label>
      {details.document && !documents.some(d=>d.id===details.document) && <p>{es ? "El documento anterior ya no está disponible. Revisa el acceso." : "The previously linked document is no longer available. Review access."}</p>}
      {dealHref && <a href={dealHref+"#deal-documents"}>{es ? "Abrir documentos y solicitudes seguros" : "Open secure documents and requests"}</a>}
      <label>{es ? "Aplicabilidad" : "Applicability"}<select name="notApplicable" defaultValue={status === "not_applicable" ? "yes" : "no"}><option value="no">{es ? "Aplica / necesita trabajo" : "Applicable / needs work"}</option><option value="yes">{es ? "No aplica (con razón)" : "Not applicable (reason required)"}</option></select></label>
      <label>{es ? "Razón de no aplicabilidad" : "Reason this does not apply"}<textarea name="reason" maxLength={500} defaultValue={details.reason}/></label>
      <p>{es ? "Esta asignación es privada: no envía invitaciones ni otorga acceso. No aplicabilidad no elimina obligaciones legales ni controles de documentos." : "Assignments are private: no invitations are sent or access granted. Not applicable does not waive legal obligations or document controls."}</p>
      {error && <p role="alert">{error}</p>}
      <button className="button button--light" disabled={busy||saving} type="submit" data-task={taskKey}>{saving ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar detalles" : "Save task details")}</button>
    </form>
  </details>;
}
