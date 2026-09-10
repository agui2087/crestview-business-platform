export const employeeColumns = ["full_name","email","position","department","manager_name","start_date","employment_status","preferred_locale"] as const;
export function csvCell(value: unknown) {
  const text=String(value??"");
  // Neutralize spreadsheet formulas even if a cell starts with control/space characters.
  const safe=/^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"','""')}"`;
}
export function employeeCsv(rows: Record<string,unknown>[]) {
  return [employeeColumns.join(','),...rows.map(row=>employeeColumns.map(key=>csvCell(row[key])).join(','))].join('\r\n');
}
