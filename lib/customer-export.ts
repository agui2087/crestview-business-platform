export type SavedExport = { opportunity_key: string; stage: string; next_action: string | null; notes: string | null; updated_at: string };
export type TaskExport = {title:string;opportunity_key:string|null;due_date:string|null;priority:string;status:string};
export type DiligenceExport = {category:string;title:string;status:string;due_date:string|null;assigned_role:string|null;notes:string|null};
export function diligenceCsv(rows:DiligenceExport[],es:boolean){
 const header=es?['Categoría','Pregunta o elemento','Estado informado por ti','Fecha límite','Responsable (no es una invitación)','Notas privadas']:['Category','Question or item','Self-reported status','Due date','Assigned role (not an invitation)','Private notes'];
 return '\uFEFF'+[header,...rows.map(row=>[row.category,row.title,row.status,row.due_date,row.assigned_role,row.notes])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function tasksCsv(rows:TaskExport[],es:boolean) {
 const header=es?['Título','Oportunidad','Fecha límite','Prioridad','Estado']:['Title','Opportunity','Due date','Priority','Status'];
 return '\uFEFF'+[header,...rows.map(row=>[row.title,row.opportunity_key,row.due_date,row.priority,row.status])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}

// Quoting alone does not prevent spreadsheet formula execution.
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function savedOpportunitiesCsv(rows: SavedExport[], titles: Map<string, string>, es: boolean) {
  const header = es ? ["Oportunidad", "Identificador", "Etapa", "Próxima acción", "Notas privadas", "Actualizado"] : ["Opportunity", "Identifier", "Stage", "Next action", "Private notes", "Updated"];
  return '\uFEFF' + [header, ...rows.map(row => [titles.get(row.opportunity_key) ?? row.opportunity_key, row.opportunity_key, row.stage, row.next_action, row.notes, row.updated_at])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
