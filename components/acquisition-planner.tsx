"use client";

import { useMemo, useState, useTransition } from "react";
import { useCrestviewUser } from "@/components/user-provider";
import type { Opportunity } from "@/lib/demo-data";
import { financingResourcesFor } from "@/lib/financing-resources";
import { saveAcquisitionWorkspace } from "@/app/[locale]/dashboard/opportunities/actions";

const stagesEn = [
  ["Quick fit check", "Confirm this business fits your goals before spending more time or money."],
  ["NDA and records", "Sign the listing NDA, then request the records you need."],
  ["Earnings and value", "Check the reported earnings and estimate a reasonable value range."],
  ["Financing", "Estimate your cash needs, find financing help, and confirm the business can support the debt."],
  ["Offer", "Put the proposed price, structure, protections, and timing in writing with professional review."],
  ["Due diligence", "Verify the important financial, legal, customer, employee, and operating claims."],
  ["Closing", "Confirm financing, approvals, agreements, funds, access, and transition details."],
  ["First 90 days", "Take control and organize the most important work after closing."],
] as const;

const stagesEs = [
  ["Revisión rápida", "Confirma que este negocio coincide con tus metas antes de invertir más tiempo o dinero."],
  ["NDA y documentos", "Firma el NDA del anuncio y luego solicita los documentos necesarios."],
  ["Ganancias y valor", "Comprueba las ganancias reportadas y calcula un rango de valor razonable."],
  ["Financiamiento", "Calcula el efectivo necesario, encuentra ayuda financiera y confirma que el negocio pueda pagar la deuda."],
  ["Oferta", "Escribe el precio, estructura, protecciones y fechas con revisión profesional."],
  ["Debida diligencia", "Verifica las afirmaciones financieras, legales, operativas, de clientes y empleados."],
  ["Cierre", "Confirma financiamiento, aprobaciones, acuerdos, fondos, accesos y transición."],
  ["Primeros 90 días", "Toma control y organiza el trabajo más importante después del cierre."],
] as const;

const checklistItemsEn = [
  [
    "Confirm the industry, location, and business size fit your search",
    "Decide whether the asking price fits your available capital",
    "Understand the owner’s current role and expected transition",
    "Identify licenses, certifications, or experience you would need",
    "Write down your reason to continue, pause, or pass",
  ],
  [
    "Open and review the exact NDA supplied for this listing",
    "Confirm your legal name and sign the NDA electronically",
    "Choose the financial and operating documents needed for your initial review",
    "Explain your acquisition timeline and financing readiness",
    "Send the separate financial-access request for broker approval",
    "Record any documents the broker declined, delayed, or asked you to clarify",
  ],
  [
    "Compare reported earnings with tax returns, financial statements, and available bank support",
    "List every owner add-back and identify the evidence supporting it",
    "Estimate the cost of replacing the seller’s work and benefits",
    "Calculate conservative, expected, and optimistic earnings cases",
    "Compare more than one valuation method or market reference",
    "Record a preliminary value range and the assumptions that could change it",
    "Have an accountant or valuation professional review material assumptions",
  ],
  [
    "Estimate the down payment, fees, and working capital you will need",
    "Choose how much cash you can safely invest",
    "Contact at least two SBA or business-acquisition lenders",
    "Get preliminary lender feedback in writing",
    "Confirm the expected cash flow can cover debt payments and your salary",
  ],
  [
    "Choose whether to send an informal indication of interest or a formal LOI",
    "State the proposed price and how it would be paid",
    "Define what is included, such as assets, inventory, cash, and assumed obligations",
    "Describe the working-capital expectation at closing",
    "Include financing, diligence, and other important contingencies",
    "Set exclusivity, diligence, and expected closing timelines",
    "Have qualified legal and tax advisors review it before signing",
  ],
  [
    "Reconcile financial statements with tax returns and bank records",
    "Verify revenue, expenses, add-backs, cash flow, and working-capital needs",
    "Review customer concentration, contracts, retention, and outstanding disputes",
    "Review employees, compensation, benefits, contractors, and key-person risk",
    "Review licenses, permits, taxes, insurance, leases, assets, and legal obligations",
    "Confirm technology ownership, security, vendor dependencies, and data access",
    "Record every unresolved issue and decide whether it changes price, terms, or your decision",
  ],
  [
    "Confirm the final agreement matches the negotiated economics and structure",
    "Review asset allocation, representations, indemnities, escrow, and survival periods",
    "Obtain final financing approval and satisfy lender conditions",
    "Confirm required landlord, customer, vendor, licensing, and regulatory consents",
    "Review the closing statement, payment instructions, and required signatures",
    "Finalize training, employee communication, access transfer, and the transition plan",
    "Receive final approval from your legal, tax, accounting, and lending advisors",
  ],
  [
    "Confirm funds were transferred and every required document was signed",
    "Confirm ownership, bank accounts, systems, passwords, and physical access were transferred",
    "Communicate with employees, customers, vendors, and other important stakeholders",
    "Record escrow releases, seller obligations, adjustments, and other post-closing deadlines",
    "Start the first 30-, 60-, and 90-day operating plan",
    "Store the final transaction documents in a secure location",
  ],
] as const;

const checklistItemsEs = [
  [
    "Confirma que la industria, ubicación y tamaño coinciden con tu búsqueda",
    "Decide si el precio solicitado se ajusta a tu capital disponible",
    "Comprende el papel actual del propietario y la transición esperada",
    "Identifica licencias, certificaciones o experiencia necesarias",
    "Escribe tu razón para continuar, pausar o abandonar",
  ],
  [
    "Abre y revisa el NDA exacto proporcionado para esta oportunidad",
    "Confirma tu nombre legal y firma el NDA electrónicamente",
    "Elige los documentos financieros y operativos necesarios para la revisión inicial",
    "Explica tu plazo de adquisición y preparación financiera",
    "Envía la solicitud separada de acceso financiero para aprobación del corredor",
    "Registra documentos rechazados, demorados o que requieren aclaración",
  ],
  [
    "Compara ganancias con declaraciones fiscales, estados financieros y respaldo bancario disponible",
    "Enumera cada ajuste del propietario y la evidencia que lo respalda",
    "Calcula el costo de reemplazar el trabajo y beneficios del vendedor",
    "Calcula escenarios conservador, esperado y optimista",
    "Compara más de un método de valoración o referencia de mercado",
    "Registra un rango preliminar y los supuestos que podrían cambiarlo",
    "Solicita revisión de supuestos importantes por un contador o profesional de valoración",
  ],
  [
    "Calcula el anticipo, los gastos y el capital de trabajo necesarios",
    "Elige cuánto efectivo puedes invertir de forma segura",
    "Contacta al menos dos prestamistas SBA o de adquisiciones",
    "Obtén comentarios preliminares del prestamista por escrito",
    "Confirma que el flujo de caja pueda cubrir la deuda y tu salario",
  ],
  [
    "Elige entre una indicación informal de interés o una LOI formal",
    "Indica el precio propuesto y cómo se pagará",
    "Define activos, inventario, efectivo y obligaciones incluidos",
    "Describe el capital de trabajo esperado al cierre",
    "Incluye contingencias de financiamiento y diligencia",
    "Establece exclusividad, diligencia y fechas de cierre",
    "Solicita revisión legal y fiscal antes de firmar",
  ],
  [
    "Concilia estados financieros con declaraciones fiscales y registros bancarios",
    "Verifica ingresos, gastos, ajustes, flujo de caja y capital de trabajo",
    "Revisa concentración, contratos, retención y disputas de clientes",
    "Revisa empleados, compensación, beneficios, contratistas y personas clave",
    "Revisa licencias, impuestos, seguros, arrendamientos, activos y obligaciones legales",
    "Confirma tecnología, seguridad, proveedores y acceso a datos",
    "Registra cada asunto pendiente y decide si cambia el precio, los términos o tu decisión",
  ],
  [
    "Confirma que el acuerdo final coincida con la economía y estructura negociadas",
    "Revisa asignación, declaraciones, indemnizaciones, depósito y plazos",
    "Obtén aprobación financiera final y cumple las condiciones del prestamista",
    "Confirma consentimientos de arrendador, clientes, proveedores y reguladores",
    "Revisa el estado de cierre, instrucciones de pago y firmas",
    "Finaliza capacitación, comunicación, accesos y transición",
    "Obtén aprobación final de asesores legales, fiscales, contables y financieros",
  ],
  [
    "Confirma la transferencia de fondos y la firma de todos los documentos",
    "Confirma la transferencia de propiedad, cuentas, sistemas, contraseñas y acceso físico",
    "Comunícate con empleados, clientes, proveedores y partes importantes",
    "Registra depósitos, obligaciones del vendedor, ajustes y fechas posteriores al cierre",
    "Inicia el plan operativo de 30, 60 y 90 días",
    "Guarda los documentos finales de forma segura",
  ],
] as const;

const readyWhenEn = [
  "You understand the basic fit, major unknowns, and whether this opportunity deserves more time.",
  "The NDA is handled and the seller or broker has a clear, written list of the information you need.",
  "You have a supportable value range and understand which assumptions still need verification.",
  "You know the likely cash requirement, financing path, and whether expected cash flow can support the debt.",
  "The proposed economics, protections, responsibilities, and timeline are written clearly and reviewed by your advisors.",
  "Important claims have been verified, material risks are documented, and remaining issues are reflected in the decision or terms.",
  "Financing, documents, approvals, funds, access, and the transition plan are ready for the scheduled closing.",
  "Control has transferred and every post-closing responsibility has an owner and due date.",
] as const;

const readyWhenEs = [
  "Comprendes el ajuste básico, las incógnitas principales y si vale la pena continuar.",
  "El NDA está resuelto y el vendedor o corredor tiene una lista escrita de la información necesaria.",
  "Tienes un rango de valor respaldado y comprendes qué supuestos faltan por verificar.",
  "Conoces el efectivo necesario, la ruta de financiamiento y si el flujo de caja puede cubrir la deuda.",
  "La economía, protecciones, responsabilidades y fechas están escritas y revisadas por tus asesores.",
  "Las afirmaciones importantes están verificadas, los riesgos documentados y los asuntos pendientes reflejados en los términos.",
  "Financiamiento, documentos, aprobaciones, fondos, accesos y transición están listos para el cierre.",
  "El control fue transferido y cada obligación posterior tiene responsable y fecha.",
] as const;

const useInformationEn = [
  [
    "Compare the opportunity with your non-negotiable criteria instead of judging it only by the asking price.",
    "Turn unknown items into specific questions for the seller or broker.",
    "If a license, owner role, or capital requirement does not fit, pause before spending money on diligence.",
  ],
  [
    "Match profit-and-loss statements to tax returns and bank deposits; unexplained differences need follow-up.",
    "Use customer information to calculate concentration and understand what happens if a major customer leaves.",
    "Use owner hours and responsibilities to estimate the cost of replacing the seller’s work.",
    "Put missing or contradictory information into the diligence tracker instead of treating it as verified.",
  ],
  [
    "Build conservative, expected, and optimistic cases rather than relying on one earnings number.",
    "Compare price multiples with the quality and stability of the earnings, not as a stand-alone answer.",
    "Use weak debt coverage or unsupported add-backs to reconsider price, financing structure, or whether to continue.",
  ],
  [
    "Compare lenders using down payment, rate, term, fees, collateral, covenants, and speed—not only the monthly payment.",
    "Ask each lender which figures they will accept and how they calculate debt-service coverage.",
    "Use lender feedback to adjust the offer, request seller financing, or add a financing contingency.",
  ],
  [
    "Use the LOI as a written roadmap for the deal, while keeping it subject to appropriate diligence and professional review.",
    "Connect every unresolved risk to a contingency, seller obligation, price adjustment, holdback, or walk-away right.",
    "Confirm which provisions are binding before signing, especially confidentiality, exclusivity, expenses, and access.",
  ],
  [
    "Trace important claims back to original evidence instead of relying on summaries or seller explanations.",
    "Maintain an issues list showing the evidence, financial effect, responsible person, and deadline for every concern.",
    "Resolve each material issue by verifying it, changing the terms, obtaining protection, or deciding not to proceed.",
  ],
  [
    "Compare every final document and dollar amount with the LOI and most recent negotiations.",
    "Use a closing checklist with one responsible person and deadline for every approval, signature, payment, and access transfer.",
    "Do not authorize closing until professional advisors confirm that required conditions are satisfied.",
  ],
  [
    "Convert every seller promise and post-closing requirement into a dated task with an owner.",
    "Use the first 90 days to protect employees, customers, cash flow, and critical operating routines before making major changes.",
    "Keep final agreements and closing evidence available for tax, escrow, warranty, and dispute questions.",
  ],
] as const;

const useInformationEs = [
  [
    "Compara la oportunidad con tus criterios indispensables, no solamente con el precio.",
    "Convierte la información desconocida en preguntas específicas para el vendedor o corredor.",
    "Si una licencia, función del propietario o capital requerido no encaja, pausa antes de gastar en diligencia.",
  ],
  [
    "Compara resultados con declaraciones fiscales y depósitos bancarios; investiga diferencias sin explicación.",
    "Usa los datos de clientes para calcular concentración y el efecto de perder un cliente importante.",
    "Usa las horas y funciones del propietario para estimar el costo de reemplazar su trabajo.",
    "Registra información faltante o contradictoria en diligencia y no la trates como verificada.",
  ],
  [
    "Crea escenarios conservador, esperado y optimista en lugar de depender de una sola cifra.",
    "Compara múltiplos con la calidad y estabilidad de las ganancias.",
    "Usa cobertura débil o ajustes sin respaldo para reconsiderar precio, financiamiento o continuidad.",
  ],
  [
    "Compara anticipo, tasa, plazo, costos, garantía, condiciones y velocidad, no solo el pago mensual.",
    "Pregunta qué cifras acepta cada prestamista y cómo calcula la cobertura de deuda.",
    "Usa sus comentarios para ajustar la oferta, solicitar financiamiento del vendedor o agregar una contingencia.",
  ],
  [
    "Usa la LOI como guía escrita, sujeta a diligencia y revisión profesional.",
    "Conecta cada riesgo con una contingencia, obligación, ajuste, retención o derecho de abandonar.",
    "Confirma qué disposiciones son obligatorias antes de firmar.",
  ],
  [
    "Conecta afirmaciones importantes con evidencia original, no solo resúmenes o explicaciones.",
    "Mantén una lista con evidencia, efecto financiero, responsable y fecha para cada asunto.",
    "Resuelve cada asunto verificándolo, cambiando términos, obteniendo protección o abandonando.",
  ],
  [
    "Compara cada documento y cantidad final con la LOI y la negociación más reciente.",
    "Asigna responsable y fecha a cada aprobación, firma, pago y transferencia de acceso.",
    "No autorices el cierre hasta que tus asesores confirmen las condiciones.",
  ],
  [
    "Convierte cada promesa y obligación posterior en una tarea con responsable y fecha.",
    "Usa los primeros 90 días para proteger empleados, clientes, flujo de caja y rutinas críticas.",
    "Conserva acuerdos y evidencia para impuestos, depósitos, garantías y disputas.",
  ],
] as const;

function parseNumber(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

type InitialWorkspace = {
  stage: string;
  current_step: number;
  checklist_progress: Record<string, string>;
  step_notes: Record<string, string>;
  valuation_inputs: Record<string, string>;
} | null;

export function AcquisitionPlanner({
  opportunity,
  initialWorkspace,
  locale,
}: {
  opportunity: Opportunity;
  initialWorkspace: InitialWorkspace;
  locale: string;
}) {
  const es = locale === "es";
  const stages = es ? stagesEs : stagesEn;
  const checklistItems = es ? checklistItemsEs : checklistItemsEn;
  const readyWhen = es ? readyWhenEs : readyWhenEn;
  const useInformation = es ? useInformationEs : useInformationEn;
  const user = useCrestviewUser();
  const [started, setStarted] = useState(Boolean(initialWorkspace && initialWorkspace.stage !== "saved"));
  const [current, setCurrent] = useState(initialWorkspace?.current_step ?? 0);
  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>(initialWorkspace?.checklist_progress ?? {});
  const [skipOpen, setSkipOpen] = useState(false);
  const [price, setPrice] = useState(initialWorkspace?.valuation_inputs.price ?? opportunity.priceValue?.toString() ?? "");
  const [sde, setSde] = useState(initialWorkspace?.valuation_inputs.sde ?? opportunity.cashFlowValue?.toString() ?? "");
  const [ebitda, setEbitda] = useState(initialWorkspace?.valuation_inputs.ebitda ?? opportunity.ebitdaValue?.toString() ?? "");
  const [debtService, setDebtService] = useState(initialWorkspace?.valuation_inputs.debtService ?? "");
  const [downPayment, setDownPayment] = useState(initialWorkspace?.valuation_inputs.downPayment ?? "10");
  const [interestRate, setInterestRate] = useState(initialWorkspace?.valuation_inputs.interestRate ?? "10.5");
  const [loanYears, setLoanYears] = useState(initialWorkspace?.valuation_inputs.loanYears ?? "10");
  const [buyerSalary, setBuyerSalary] = useState(initialWorkspace?.valuation_inputs.buyerSalary ?? "");
  const [workingCapital, setWorkingCapital] = useState(initialWorkspace?.valuation_inputs.workingCapital ?? "");
  const [stepNotes, setStepNotes] = useState<Record<string, string>>(initialWorkspace?.step_notes ?? {});
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [copied, setCopied] = useState(false);
  const [selectedRequestItems, setSelectedRequestItems] = useState<string[]>(() => [...opportunity.missing]);

  const metrics = useMemo(() => {
    const p = parseNumber(price);
    const s = parseNumber(sde);
    const e = parseNumber(ebitda);
    const d = parseNumber(debtService);
    const down = parseNumber(downPayment) ?? 0;
    const rate = (parseNumber(interestRate) ?? 0) / 1200;
    const months = (parseNumber(loanYears) ?? 0) * 12;
    const salary = parseNumber(buyerSalary) ?? 0;
    const working = parseNumber(workingCapital) ?? 0;
    const equity = p === null ? null : p * (down / 100);
    const loan = p === null || equity === null ? null : Math.max(0, p - equity + working);
    const monthlyPayment = loan !== null && months > 0
      ? rate > 0 ? loan * rate * ((1 + rate) ** months) / (((1 + rate) ** months) - 1) : loan / months
      : null;
    const calculatedDebtService = monthlyPayment === null ? null : monthlyPayment * 12;
    const availableCashFlow = s === null ? null : s - salary;
    const coverageDebt = d || calculatedDebtService;
    return {
      priceToSde: p !== null && s ? p / s : null,
      priceToEbitda: p !== null && e ? p / e : null,
      equity, loan, monthlyPayment,
      dscr: availableCashFlow !== null && coverageDebt ? availableCashFlow / coverageDebt : null,
    };
  }, [price, sde, ebitda, debtService, downPayment, interestRate, loanYears, buyerSalary, workingCapital]);

  function persist(nextCurrent = current, nextStatuses = stepStatuses) {
    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("opportunity_key", opportunity.id);
    formData.set("current_step", String(nextCurrent));
    formData.set("checklist_progress", JSON.stringify(nextStatuses));
    formData.set("step_notes", JSON.stringify(stepNotes));
    formData.set("valuation_inputs", JSON.stringify({ price, sde, ebitda, debtService, downPayment, interestRate, loanYears, buyerSalary, workingCapital }));
    startSaving(async () => {
      const result = await saveAcquisitionWorkspace(formData);
      setSaveMessage(result.message);
    });
  }

  function advance(status: "complete" | "skipped") {
    const nextStatuses = { ...stepStatuses, [String(current)]: status };
    const nextCurrent = Math.min(stages.length - 1, current + 1);
    setStepStatuses(nextStatuses);
    setCurrent(nextCurrent);
    persist(nextCurrent, nextStatuses);
  }

  function itemKey(step: number, item: number) {
    return `item:${step}:${item}`;
  }

  function toggleChecklistItem(itemIndex: number) {
    const key = itemKey(current, itemIndex);
    const nextStatuses = {
      ...stepStatuses,
      [key]: stepStatuses[key] === "complete" ? "open" : "complete",
    };
    setStepStatuses(nextStatuses);
    persist(current, nextStatuses);
  }

  function recordDecision(decision: "continue" | "pause" | "pass") {
    const nextStatuses = { ...stepStatuses, [`decision:${current}`]: decision };
    setStepStatuses(nextStatuses);
    persist(current, nextStatuses);
  }

  if (!started) {
    return (
      <section className="begin-panel">
        <div><span>{es ? "Espacio de adquisición" : "Acquisition workspace"}</span><h2>{es ? "¿Listo para evaluar esta oportunidad?" : "Ready to evaluate this opportunity?"}</h2><p>{es ? "Inicia una lista guiada desde la evaluación hasta el cierre. Avanza a tu ritmo y marca información faltante." : "Start a guided checklist from screening through closing. You can move at your own pace and flag missing information for the seller or broker."}</p></div>
        <button className="button button--primary" onClick={() => setStarted(true)}>{es ? "Iniciar adquisición" : "Begin acquisition"}</button>
      </section>
    );
  }

  const requestItems = opportunity.missing;
  const localFinancingResources = financingResourcesFor(opportunity.location);
  const selectedRequestList = selectedRequestItems.length
    ? `\n\nFor my initial review, I would like to request:\n${selectedRequestItems.map((item) => `• ${item}`).join("\n")}`
    : "";
  const brokerRequest = `Hello${opportunity.brokerName ? ` ${opportunity.brokerName}` : ""},\n\nI am interested in “${opportunity.title}” (${opportunity.sourceId}). Please confirm that it is still available.${selectedRequestList}\n\nI am happy to complete the listing NDA before reviewing confidential records.\n\nThank you,\n${user.displayName}`;
  function toggleRequestItem(item: string) {
    setSelectedRequestItems((currentItems) =>
      currentItems.includes(item)
        ? currentItems.filter((currentItem) => currentItem !== item)
        : [...currentItems, item],
    );
  }
  async function copyBrokerRequest() {
    try {
      await navigator.clipboard.writeText(brokerRequest);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = brokerRequest;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  const atLastStep = current === stages.length - 1;
  const currentChecklist = checklistItems[current];
  const completedChecklistItems = currentChecklist.filter((_, index) => stepStatuses[itemKey(current, index)] === "complete").length;
  const allChecklistItems = checklistItems.reduce((total, items) => total + items.length, 0);
  const allCompletedItems = checklistItems.reduce((total, items, step) =>
    total + items.filter((_, index) => stepStatuses[itemKey(step, index)] === "complete").length, 0);
  const overallProgress = allChecklistItems ? Math.round((allCompletedItems / allChecklistItems) * 100) : 0;
  const currentDecision = stepStatuses[`decision:${current}`] ?? "";
  const professionalGuidance = [
    ["Business advisor", "Use an SBA resource partner to test fit, ownership demands, and the acquisition plan.", "https://www.sba.gov/local-assistance"],
    ["Attorney", "Confirm the NDA is appropriate and understand its restrictions before relying on it.", "https://www.usa.gov/legal-aid"],
    ["Accountant or valuation professional", "Review earnings adjustments, tax records, and material valuation assumptions.", "https://www.sba.gov/business-guide/plan-your-business/buy-existing-business-or-franchise"],
    ["Acquisition lender", "Confirm eligible uses, cash contribution, underwriting assumptions, and lender conditions.", "https://www.sba.gov/funding-programs/loans/7a-loans"],
    ["Attorney and tax advisor", "Review binding terms, structure, allocation, contingencies, and tax consequences before signing.", "https://www.sba.gov/business-guide/grow-your-business/merge-acquire-businesses"],
    ["Attorney and accountant", "Investigate exceptions and connect each material claim to original evidence.", "https://www.sba.gov/business-guide/plan-your-business/buy-existing-business-or-franchise"],
    ["Attorney, accountant, and lender", "Confirm documents, allocation, approvals, funds, and closing conditions.", "https://www.irs.gov/forms-pubs/about-form-8594"],
    ["Accountant and operating advisors", "Track tax filings, transition promises, access transfers, and post-closing deadlines.", "https://www.sba.gov/business-guide/grow-your-business/merge-acquire-businesses"],
  ][current];
  const generalResources = [
    {
      label: es ? "Guía de SBA para comprar un negocio" : "SBA guide to buying an existing business",
      description: es ? "Conceptos básicos, valoración, diligencia y ayuda profesional." : "Plain-language guidance on evaluation, valuation, diligence, and professional help.",
      href: "https://www.sba.gov/business-guide/plan-your-business/buy-existing-business-or-franchise",
    },
    {
      label: es ? "Asistencia local de SBA" : "SBA local assistance",
      description: es ? `Busca SBDC, SCORE y otros asesores cerca de ${opportunity.location}.` : `Find SBDC, SCORE, and other business advisors serving ${opportunity.location}.`,
      href: "https://www.sba.gov/local-assistance",
    },
  ];
  const stageResources = generalResources;

  return (
    <section className="acquisition-workspace">
      <aside className="acquisition-steps">
        <p>{es ? "Lista de adquisición" : "Acquisition checklist"}</p>
        <div className="checklist-overall-progress"><strong>{overallProgress}%</strong><span>{es ? "progreso total" : "overall progress"}</span><i><b style={{ width: `${overallProgress}%` }} /></i></div>
        {stages.map(([title], index) => (
          <button className={index === current ? "is-current" : stepStatuses[String(index)] === "complete" ? "is-complete" : stepStatuses[String(index)] === "skipped" ? "is-skipped" : ""} onClick={() => setCurrent(index)} key={title}>
            <span>{stepStatuses[String(index)] === "complete" ? "✓" : stepStatuses[String(index)] === "skipped" ? "!" : index + 1}</span>{title}
          </button>
        ))}
      </aside>
      <div className="acquisition-stage">
        <span className="mini-label">{es ? "Paso" : "Step"} {current + 1} {es ? "de" : "of"} {stages.length}</span>
        <h2>{stages[current][0]}</h2>
        <p className="stage-intro">{stages[current][1]}</p>

        {currentChecklist.length > 0 && <div className="check-card">
          <div className="check-card__heading">
            <h3>{es ? "Qué hacer" : "What to do"}</h3>
            <span>{completedChecklistItems}/{currentChecklist.length} {es ? "completados" : "completed"}</span>
          </div>
          {currentChecklist.map((item, index) => <label key={item}>
            <input type="checkbox" checked={stepStatuses[itemKey(current, index)] === "complete"} onChange={() => toggleChecklistItem(index)} />
            {item}
          </label>)}
        </div>}

        {current === 1 && <div className="workflow-connection"><div><span>Simple two-step request</span><strong>Sign the NDA first, then ask for records</strong><p>Crestview listings deliver the broker’s NDA automatically. The broker only needs to review your financial-record request.</p></div><a href={`/${locale}/dashboard/marketplace`}>Go to marketplace →</a></div>}
        {current === 1 && <details className="request-builder"><summary>Need to contact a broker outside Crestview?</summary><div className="request-grid"><div className="check-card"><div className="check-card__heading"><h3>Choose what to request</h3><span>{selectedRequestItems.length} selected</span></div>{requestItems.map((item) => <label key={item}><input type="checkbox" checked={selectedRequestItems.includes(item)} onChange={() => toggleRequestItem(item)} />{item}</label>)}</div><div className="outreach-card"><span>Message draft</span><pre aria-live="polite">{brokerRequest}</pre><div className="outreach-actions"><button type="button" onClick={copyBrokerRequest}>{copied ? "Copied ✓" : "Copy message"}</button>{opportunity.brokerEmail && <a href={`mailto:${opportunity.brokerEmail}?subject=${encodeURIComponent(`Inquiry about listing ${opportunity.sourceId}`)}&body=${encodeURIComponent(brokerRequest)}`}>Open email</a>}</div></div></div></details>}

        {current === 2 && <div className="valuation-area">
          <div className="valuation-form">
            <label>Asking price<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="Inquire with seller" /></label>
            <label>Normalized SDE / cash flow<input value={sde} onChange={(event) => setSde(event.target.value)} inputMode="decimal" placeholder="N/A" /></label>
            <label>Normalized EBITDA<input value={ebitda} onChange={(event) => setEbitda(event.target.value)} inputMode="decimal" placeholder="N/A" /></label>
            <label>Estimated annual debt service<input value={debtService} onChange={(event) => setDebtService(event.target.value)} inputMode="decimal" placeholder="Enter lender estimate" /></label>
            <label>Down payment percentage<input value={downPayment} onChange={(event) => setDownPayment(event.target.value)} inputMode="decimal" placeholder="10" /></label>
            <label>Interest rate percentage<input value={interestRate} onChange={(event) => setInterestRate(event.target.value)} inputMode="decimal" placeholder="10.5" /></label>
            <label>Loan term in years<input value={loanYears} onChange={(event) => setLoanYears(event.target.value)} inputMode="numeric" placeholder="10" /></label>
            <label>Buyer salary adjustment<input value={buyerSalary} onChange={(event) => setBuyerSalary(event.target.value)} inputMode="decimal" placeholder="0" /></label>
            <label>Additional working capital<input value={workingCapital} onChange={(event) => setWorkingCapital(event.target.value)} inputMode="decimal" placeholder="0" /></label>
          </div>
          <div className="valuation-summary">
            <h3>Calculation summary</h3>
            <div><span>Price ÷ SDE</span><strong>{metrics.priceToSde ? `${metrics.priceToSde.toFixed(2)}×` : "N/A"}</strong></div>
            <div><span>Price ÷ EBITDA</span><strong>{metrics.priceToEbitda ? `${metrics.priceToEbitda.toFixed(2)}×` : "N/A"}</strong></div>
            <div><span>Illustrative debt coverage</span><strong>{metrics.dscr ? `${metrics.dscr.toFixed(2)}×` : "N/A"}</strong></div>
            <div><span>Estimated buyer equity</span><strong>{metrics.equity !== null ? `$${Math.round(metrics.equity).toLocaleString()}` : "N/A"}</strong></div>
            <div><span>Estimated loan amount</span><strong>{metrics.loan !== null ? `$${Math.round(metrics.loan).toLocaleString()}` : "N/A"}</strong></div>
            <div><span>Estimated monthly payment</span><strong>{metrics.monthlyPayment !== null ? `$${Math.round(metrics.monthlyPayment).toLocaleString()}` : "N/A"}</strong></div>
            <p>{metrics.dscr !== null && metrics.dscr < 1.25 ? "Needs attention: the entered cash flow may provide limited room above estimated debt payments." : metrics.dscr !== null ? "Positive signal: the entered cash flow is above the estimated debt payments. Confirm with a lender." : "Enter cash flow and estimated debt service to calculate an illustrative coverage ratio."}</p>
          </div>
        </div>}

        {current === 3 && <section className="financing-help" aria-labelledby="financing-help-title">
          <header>
            <div>
              <span>{es ? "Ayuda local para financiar" : "Local financing help"}</span>
              <h3 id="financing-help-title">{es ? `Recursos que sirven a ${opportunity.location}` : `Resources serving ${opportunity.location}`}</h3>
              <p>{es ? "Empieza con la lista oficial de prestamistas y compara al menos dos opciones. La ubicación del negocio determina los recursos mostrados." : "Start with the official participating-lender list and compare at least two options. The business location determines which resources appear."}</p>
            </div>
            <div className="financing-path"><strong>1</strong><span>{es ? "Prepara tus números" : "Prepare your numbers"}</span><i>→</i><strong>2</strong><span>{es ? "Habla con prestamistas" : "Talk to lenders"}</span><i>→</i><strong>3</strong><span>{es ? "Compara términos" : "Compare terms"}</span></div>
          </header>
          <div className="financing-resource-grid">{localFinancingResources.map((resource) => <article key={resource.href}>
            <div><span className={`resource-kind resource-kind--${resource.kind}`}>{resource.kind === "lenders" ? (es ? "Lista oficial" : "Official lender list") : resource.kind === "office" ? (es ? "Oficina SBA" : "SBA office") : resource.kind === "advisor" ? (es ? "Asesoría" : "Counseling") : (es ? "Comparar" : "Get matched")}</span><small>{resource.area}</small></div>
            <h4>{resource.name}</h4>
            <p>{es ? resource.descriptionEs : resource.description}</p>
            {resource.phone && <a className="resource-phone" href={`tel:${resource.phone}`}>{es ? "Llamar" : "Call"} {resource.phone}</a>}
            <a className="resource-link" href={resource.href} target="_blank" rel="noreferrer">{es ? "Abrir fuente oficial" : "Open official source"} →</a>
            <small>{es ? "Comprobado" : "Checked"}: {resource.checked}</small>
          </article>)}</div>
          <div className="lender-compare-note"><strong>{es ? "Pregunta a cada prestamista" : "Ask every lender"}</strong><p>{es ? "¿Financian compras de negocios? ¿Cuál es el anticipo estimado? ¿Qué documentos necesitan? ¿Cuáles son la tasa, plazo, comisiones, garantía y tiempo de cierre?" : "Do you finance business acquisitions? What down payment do you expect? Which documents do you need? What are the rate, term, fees, collateral, and expected closing time?"}</p></div>
          <p className="financing-disclaimer">{es ? "Crestview muestra fuentes oficiales y recursos regionales, pero no garantiza aprobación ni recomienda un prestamista específico. Compara términos y confirma todos los requisitos directamente." : "Crestview shows official sources and regional resources, but does not guarantee approval or recommend a specific lender. Compare terms and confirm every requirement directly."}</p>
        </section>}

        {atLastStep && <div className="completion-card"><span>✓</span><h3>Purchase complete</h3><p>Use this stage only after your professional advisors confirm the transaction has closed. Record transition obligations, working-capital adjustments, escrow dates, and post-closing commitments.</p></div>}

        <div className="information-use-card">
          <span>{es ? "Cómo usar esta información" : "How to use what you learn"}</span>
          <ul>{useInformation[current].map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <details className="trusted-help">
          <summary>{es ? "Fuentes confiables y ayuda profesional" : "Trusted sources and professional help"}</summary>
          <div className="acquisition-resources">
            <div><span>{es ? "Referencias útiles" : "Helpful references"}</span><p>{es ? "Confirma los detalles directamente con cada profesional o prestamista." : "Confirm important details directly with the appropriate professional or lender."}</p></div>
            <div>{stageResources.map((resource) => <a href={resource.href} target="_blank" rel="noreferrer" key={resource.href}><strong>{resource.label} ↗</strong><span>{resource.description}</span></a>)}</div>
          </div>
          <div className="professional-review-card">
            <div><span>{es ? "Ayuda recomendada" : "Recommended help"}</span><strong>{professionalGuidance[0]}</strong></div>
            <p>{professionalGuidance[1]}</p>
            <a href={professionalGuidance[2]} target="_blank" rel="noreferrer">{es ? "Abrir fuente oficial" : "Open official source"} ↗</a>
            <small>{es ? "Información educativa general. Crestview no brinda asesoría legal, fiscal, contable o financiera." : "General educational information. Crestview does not provide legal, tax, accounting, lending, or investment advice."}</small>
          </div>
        </details>
        <div className="step-finish-note">
          <span>{es ? "Listo para continuar cuando" : "Ready to continue when"}</span>
          <p>{readyWhen[current]}</p>
        </div>
        <details className="stage-notes-wrap">
          <summary>{es ? "Agregar notas (opcional)" : "Add notes (optional)"}</summary>
          <label className="stage-notes">Notes and evidence<textarea value={stepNotes[String(current)] ?? ""} onChange={(event) => setStepNotes((existing) => ({ ...existing, [String(current)]: event.target.value }))} onBlur={() => persist()} placeholder="What did you verify? What is still missing? Who owns the next action?" /></label>
        </details>
        <div className="decision-gate">
          <div><span>{es ? "Decisión de esta etapa" : "Stage decision"}</span><strong>{es ? "¿Qué debes hacer ahora?" : "What should happen next?"}</strong><p>{es ? "Registra una decisión clara. Puedes cambiarla después." : "Record a clear decision. You can change it later."}</p></div>
          <div>
            <button className={currentDecision === "continue" ? "is-selected" : ""} type="button" onClick={() => recordDecision("continue")}>Ready for next step</button>
            <button className={currentDecision === "pause" ? "is-selected" : ""} type="button" onClick={() => recordDecision("pause")}>I need more time</button>
            <button className={currentDecision === "pass" ? "is-selected" : ""} type="button" onClick={() => recordDecision("pass")}>Not a fit</button>
          </div>
        </div>
        {saveMessage && <p className="workspace-save-message" aria-live="polite">{saveMessage}</p>}
        <p className="advisor-note">Crestview provides organizational tools and illustrative calculations, not legal, tax, accounting, lending, or investment advice.</p>
        <div className="stage-actions">
          <button className="button button--light" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))}>Back</button>
          <button className="button button--light" disabled={isSaving} onClick={() => persist()}>{isSaving ? "Saving…" : "Save progress"}</button>
          {!atLastStep && <><button className="skip-link" onClick={() => setSkipOpen(true)}>Do this later</button><button className="button button--primary" disabled={isSaving || currentDecision !== "continue"} onClick={() => advance("complete")}>Save and continue</button></>}
        </div>
      </div>

      {skipOpen && <div className="modal-backdrop" role="presentation"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="skip-title"><span>!</span><h2 id="skip-title">Are you sure you want to skip this step?</h2><p>Missing work can create financial, legal, or operational risk. Crestview will mark this step as skipped so you can return later.</p><div><button className="button button--light" onClick={() => setSkipOpen(false)}>Keep working</button><button className="button button--primary" onClick={() => { setSkipOpen(false); advance("skipped"); }}>Skip and continue</button></div></div></div>}
    </section>
  );
}
