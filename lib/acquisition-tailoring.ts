export type DealPlan = {
  financing: "undecided" | "cash" | "sba" | "conventional" | "seller";
  industry: "general" | "service" | "retail" | "manufacturing" | "healthcare";
  employees: "unknown" | "yes" | "no";
  property: "unknown" | "yes" | "no";
};
export type TaskDetails = {
  owner: "buyer" | "broker" | "lender" | "advisor";
  assignee: string;
  due: string;
  waiting: "none" | "buyer" | "broker" | "lender" | "advisor";
  reason: string;
  document: string;
};
export const defaultDealPlan: DealPlan = { financing: "undecided", industry: "general", employees: "unknown", property: "unknown" };
export const defaultTaskDetails: TaskDetails = { owner: "buyer", assignee: "", due: "", waiting: "none", reason: "", document: "" };
export function readDealPlan(raw?: string): DealPlan | null {
  try {
    const p = JSON.parse(raw ?? "null");
    if (!p || !["undecided","cash","sba","conventional","seller"].includes(p.financing) ||
      !["general","service","retail","manufacturing","healthcare"].includes(p.industry) ||
      !["unknown","yes","no"].includes(p.employees) || !["unknown","yes","no"].includes(p.property)) return null;
    return { financing:p.financing, industry:p.industry, employees:p.employees, property:p.property };
  } catch { return null; }
}
export function validTaskDate(date: string) {
  if(!date)return true;
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))return false;
  const parsed=new Date(date+"T00:00:00Z");
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
}
export function readTaskDetails(raw?: string): TaskDetails | null {
  try {
    const d = JSON.parse(raw ?? "{}");
    const merged = {...defaultTaskDetails, ...d};
    if (!d || typeof d !== "object" || Array.isArray(d) || !["buyer","broker","lender","advisor"].includes(merged.owner) ||
      !["none","buyer","broker","lender","advisor"].includes(merged.waiting) ||
      typeof merged.assignee !== "string" || merged.assignee.length > 100 ||
      typeof merged.reason !== "string" || merged.reason.length > 500 ||
      typeof merged.due !== "string" || !validTaskDate(merged.due) ||
      typeof merged.document !== "string" || merged.document && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(merged.document)) return null;
    return { owner:merged.owner, assignee:merged.assignee.trim(), due:merged.due, waiting:merged.waiting, reason:merged.reason.trim(), document:merged.document };
  } catch { return null; }
}
export function taskIsResolved(statuses: Readonly<Record<string,string>>, step:number, item:number) {
  const key = `item:${step}:${item}`;
  if (statuses[key] === "complete") return true;
  return statuses[key] === "not_applicable" && (readTaskDetails(statuses[`details:${key}`])?.reason.length ?? 0) >= 10;
}
export function validateTaskMetadata(statuses: Readonly<Record<string,string>>) {
  if (statuses["plan:profile"] && !readDealPlan(statuses["plan:profile"])) return false;
  for (const [key,value] of Object.entries(statuses)) {
    if (key.startsWith("details:") && (!/^details:item:[0-7]:\d{1,2}$/.test(key) || !readTaskDetails(value))) return false;
    if (value === "not_applicable" && /^item:[0-7]:\d{1,2}$/.test(key) &&
      (readTaskDetails(statuses[`details:${key}`])?.reason.length ?? 0) < 10) return false;
  }
  return true;
}
export function tailoredChecklist(base: readonly (readonly string[])[], plan: DealPlan | null, es: boolean): string[][] {
  const items = base.map(stage => [...stage]);
  if (!plan) return items;
  if (plan.financing === "cash") {
    items[3] = es ? [
      "Estima el precio, gastos de cierre y reserva operativa necesarios",
      "Confirma el efectivo disponible sin comprometer tu reserva personal",
      "Documenta las fuentes de fondos con tu asesor o agente de cierre",
      "Confirma cómo y cuándo deben estar disponibles los fondos",
      "Revisa el efectivo restante para operar el negocio después del cierre",
    ] : [
      "Estimate the purchase price, closing costs, and operating reserve needed",
      "Confirm available cash without compromising your personal reserve",
      "Document funding sources with your advisor or closing agent",
      "Confirm how and when funds must be available for closing",
      "Review the remaining cash available to operate the business after closing",
    ];
    items[6][2] = es ? "Confirma que los fondos de compra estarán disponibles para el cierre" : "Confirm purchase funds will be available for closing";
  }
  if (plan.financing === "seller") {
    items[3][2] = es ? "Revisa la propuesta de financiamiento del vendedor con tus asesores" : "Review the seller-financing proposal with your advisors";
    items[3][3] = es ? "Documenta las condiciones pendientes del financiamiento del vendedor" : "Document the outstanding seller-financing conditions";
    items[6][2] = es ? "Confirma las condiciones finales del financiamiento del vendedor" : "Confirm the final seller-financing conditions";
  }
  const industryTasks = {
    general: ["Identify industry-specific permits and operating requirements with an advisor","Identifica permisos y requisitos operativos específicos con un asesor"],
    service: ["Review service agreements, equipment, licensing and continuity of delivery","Revisa contratos de servicio, equipo, licencias y continuidad del servicio"],
    retail: ["Review inventory condition, supplier terms, lease and point-of-sale access","Revisa inventario, proveedores, arrendamiento y acceso al punto de venta"],
    manufacturing: ["Review equipment condition, production dependencies and operating permits","Revisa equipos, dependencias de producción y permisos operativos"],
    healthcare: ["Have qualified advisors review licensing, credentialing and protected-data obligations","Pide a asesores calificados revisar licencias, credenciales y obligaciones de datos protegidos"],
  };
  // Stable appended indexes; never shift or delete existing stored task keys.
  items[5].push(industryTasks[plan.industry][es ? 1 : 0]);
  items[5].push(plan.employees==="no"?(es?"Confirma que no se transfieren empleados e identifica obligaciones laborales pendientes":"Confirm no employees transfer and identify any outstanding employment obligations"):plan.employees==="yes"?(es?"Documenta responsables y plazos de la transición de empleados":"Document owners and deadlines for the employee transition"):(es?"Confirma si se transfieren empleados":"Confirm whether employees transfer"));
  items[5].push(plan.property==="no"?(es?"Confirma que se excluye propiedad inmobiliaria y revisa posibles arrendamientos":"Confirm real estate is excluded and review any lease requirements"):plan.property==="yes"?(es?"Coordina la revisión de título, condición y uso de la propiedad con tus asesores":"Coordinate title, condition and permitted-use review with your property advisors"):(es?"Confirma si se incluye propiedad inmobiliaria":"Confirm whether real estate is included"));
  return items;
}
export function changeDealPlan(statuses: Record<string,string>, plan: DealPlan) {
  const before = readDealPlan(statuses["plan:profile"]);
  const next: Record<string,string> = {...statuses, "plan:profile":JSON.stringify(plan)};
  if (JSON.stringify(before) === JSON.stringify(plan)) return next;
  // Keep notes, reasons and unaffected work. Changed wording needs a new check.
  if (before?.financing !== plan.financing) {
    for (let item=0; item<5; item++) next[`item:3:${item}`] = "open";
    next["item:6:2"] = "open";
  }
  for (let item=7; item<10; item++) next[`item:5:${item}`] = "open";
  for (let step=0; step<8; step++) next[String(step)] = "open";
  return next;
}
