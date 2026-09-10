export function validDate(value: string) {
  return !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}
export function needsAttention(record: { record_type: string; expires_on: string | null }, today = new Date().toISOString().slice(0, 10)) {
  return ["certification", "document"].includes(record.record_type) && !!record.expires_on && Date.parse(record.expires_on) - Date.parse(today) <= 60 * 86400000;
}
export function pendingTimeOff(record: { record_type: string; status: string }) {
  return record.record_type === "pto" && ["active", "pending"].includes(record.status);
}
export function parseEmployeeCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i <= input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === undefined) throw new Error("csv");
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
    } else if (c === '"' && field === "" && !closed) quoted = true;
    else if (c === "," || c === "\r" || c === "\n" || c === undefined) {
      row.push(field.trim()); field = ""; closed = false;
      if (c !== ",") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === "\r" && input[i + 1] === "\n") i++;
      }
    } else {
      if (closed || c === '"') throw new Error("csv");
      field += c;
    }
  }
  const header = rows.shift() ?? [];
  const allowed = ["full_name", "email", "position", "department", "manager_name", "start_date", "employment_status", "preferred_locale"];
  if (!header.includes("full_name") || new Set(header).size !== header.length || header.some(h => !allowed.includes(h)) || !rows.length || rows.length > 500) throw new Error("csv");
  return rows.map(cells => {
    if (cells.length !== header.length) throw new Error("csv");
    const v = Object.fromEntries(header.map((h, i) => [h, cells[i]]));
    if (!v.full_name || v.full_name.length > 200 || !validDate(v.start_date ?? "") || (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) || (v.preferred_locale && !["en", "es"].includes(v.preferred_locale)) || (v.employment_status && !["active", "leave", "terminated"].includes(v.employment_status))) throw new Error("csv");
    return { full_name: v.full_name, email: v.email || null, position: v.position || null, department: v.department || null, manager_name: v.manager_name || null, start_date: v.start_date || null, preferred_locale: v.preferred_locale || "en", employment_status: v.employment_status || "active" };
  });
}
