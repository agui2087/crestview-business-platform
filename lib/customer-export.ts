export type SavedExport = { opportunity_key: string; stage: string; next_action: string | null; notes: string | null; updated_at: string };

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
