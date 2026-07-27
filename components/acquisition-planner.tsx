"use client";

import { useMemo, useState, useTransition } from "react";
import { useCrestviewUser } from "@/components/user-provider";
import type { Opportunity } from "@/lib/demo-data";
import { saveAcquisitionWorkspace } from "@/app/[locale]/dashboard/opportunities/actions";

const stagesEn = [
  ["Initial screening", "Confirm fit, seller expectations, licenses, and basic financial availability."],
  ["Confidentiality and information request", "Execute the NDA and request financial, operational, customer, employee, and legal records."],
  ["Valuation", "Normalize earnings, test valuation ranges, and identify unsupported adjustments."],
  ["Financing readiness", "Review equity needs, lender fit, debt coverage, working capital, and seller-financing terms."],
  ["Indication of interest or LOI", "Document price, structure, exclusivity, diligence access, contingencies, and timing with counsel."],
  ["Due diligence", "Validate financial, tax, legal, operational, customer, employee, technology, insurance, and compliance claims."],
  ["Definitive agreement and closing", "Finalize allocation, representations, consents, financing, escrow, transition, and closing deliverables."],
  ["Purchase complete", "Confirm funds and documents, transfer control, begin transition, and track post-closing obligations."],
] as const;

const stagesEs = [
  ["Evaluación inicial", "Confirma el ajuste, expectativas del vendedor, licencias y disponibilidad financiera básica."],
  ["Confidencialidad y solicitud de información", "Firma el NDA y solicita registros financieros, operativos, de clientes, empleados y legales."],
  ["Valoración", "Normaliza ganancias, prueba rangos de valor e identifica ajustes sin respaldo."],
  ["Preparación financiera", "Revisa capital, prestamista, cobertura de deuda, capital de trabajo y financiamiento del vendedor."],
  ["Indicación de interés o LOI", "Documenta precio, estructura, exclusividad, acceso a diligencia, contingencias y tiempos con asesoría legal."],
  ["Debida diligencia", "Valida afirmaciones financieras, fiscales, legales, operativas, de clientes, empleados, tecnología, seguros y cumplimiento."],
  ["Acuerdo definitivo y cierre", "Finaliza asignación, declaraciones, consentimientos, financiamiento, depósito, transición y entregables."],
  ["Compra completada", "Confirma fondos y documentos, transfiere control e inicia la transición y obligaciones posteriores."],
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

  if (!started) {
    return (
      <section className="begin-panel">
        <div><span>{es ? "Espacio de adquisición" : "Acquisition workspace"}</span><h2>{es ? "¿Listo para evaluar esta oportunidad?" : "Ready to evaluate this opportunity?"}</h2><p>{es ? "Inicia una lista guiada desde la evaluación hasta el cierre. Avanza a tu ritmo y marca información faltante." : "Start a guided checklist from screening through closing. You can move at your own pace and flag missing information for the seller or broker."}</p></div>
        <button className="button button--primary" onClick={() => setStarted(true)}>{es ? "Iniciar adquisición" : "Begin acquisition"}</button>
      </section>
    );
  }

  const requestItems = opportunity.missing;
  const selectedRequestList = selectedRequestItems.length
    ? ` and provide the following information where available:\n\n${selectedRequestItems.map((item) => `• ${item}`).join("\n")}`
    : "";
  const brokerRequest = `Hello${opportunity.brokerName ? ` ${opportunity.brokerName}` : ""},\n\nMy name is ${user.displayName}, and I am interested in listing ${opportunity.sourceId}, “${opportunity.title}.” Please confirm that it is still available${selectedRequestList}.\n\nPlease also share the NDA and supporting documents required for an initial review. I will treat all information as confidential and subject to the applicable NDA.\n\nThank you,\n${user.displayName}`;
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

  return (
    <section className="acquisition-workspace">
      <aside className="acquisition-steps">
        <p>{es ? "Lista de adquisición" : "Acquisition checklist"}</p>
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

        {current === 0 && <div className="check-card"><h3>Initial fit review</h3>{["Matches your preferred industry and geography","Purchase price fits available capital","Required licenses are understood","Owner role and transition expectations are clear"].map((item) => <label key={item}><input type="checkbox" />{item}</label>)}</div>}

        {current === 1 && <div className="request-grid"><div className="check-card"><div className="check-card__heading"><h3>Information to request</h3><span>{selectedRequestItems.length} selected</span></div>{requestItems.map((item) => <label key={item}><input type="checkbox" checked={selectedRequestItems.includes(item)} onChange={() => toggleRequestItem(item)} />{item}</label>)}</div><div className="outreach-card"><span>Broker request draft · updates live</span><pre aria-live="polite">{brokerRequest}</pre><div className="outreach-actions"><button type="button" onClick={copyBrokerRequest}>{copied ? "Copied ✓" : "Copy request"}</button>{opportunity.brokerEmail && <a href={`mailto:${opportunity.brokerEmail}?subject=${encodeURIComponent(`Inquiry about listing ${opportunity.sourceId}`)}&body=${encodeURIComponent(brokerRequest)}`}>Open in email</a>}</div></div></div>}

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

        {current > 2 && current < 7 && <div className="check-card"><h3>{stages[current][0]} checklist</h3>{[
          current === 3 ? "Confirm buyer equity and liquidity" : "Engage qualified legal and tax advisors",
          current === 3 ? "Obtain lender feedback or term sheet" : "Document assumptions, contingencies, and approvals",
          current === 5 ? "Reconcile financial statements to tax returns and bank records" : "Confirm responsible owner and deadline",
          current === 6 ? "Review final closing statement and asset allocation" : "Record unresolved risks and required follow-up",
        ].map((item) => <label key={item}><input type="checkbox" />{item}</label>)}</div>}

        {atLastStep && <div className="completion-card"><span>✓</span><h3>Purchase complete</h3><p>Use this stage only after your professional advisors confirm the transaction has closed. Record transition obligations, working-capital adjustments, escrow dates, and post-closing commitments.</p></div>}

        <label className="stage-notes">Notes and evidence<textarea value={stepNotes[String(current)] ?? ""} onChange={(event) => setStepNotes((existing) => ({ ...existing, [String(current)]: event.target.value }))} placeholder="Record what you verified, what is still missing, and who owns the next action." /></label>
        {saveMessage && <p className="workspace-save-message" aria-live="polite">{saveMessage}</p>}
        <p className="advisor-note">Crestview provides organizational tools and illustrative calculations, not legal, tax, accounting, lending, or investment advice.</p>
        <div className="stage-actions">
          <button className="button button--light" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))}>Back</button>
          <button className="button button--light" disabled={isSaving} onClick={() => persist()}>{isSaving ? "Saving…" : "Save progress"}</button>
          {!atLastStep && <><button className="skip-link" onClick={() => setSkipOpen(true)}>Skip this step</button><button className="button button--primary" disabled={isSaving} onClick={() => advance("complete")}>Mark complete and continue</button></>}
        </div>
      </div>

      {skipOpen && <div className="modal-backdrop" role="presentation"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="skip-title"><span>!</span><h2 id="skip-title">Are you sure you want to skip this step?</h2><p>Missing work can create financial, legal, or operational risk. Crestview will mark this step as skipped so you can return later.</p><div><button className="button button--light" onClick={() => setSkipOpen(false)}>Keep working</button><button className="button button--primary" onClick={() => { setSkipOpen(false); advance("skipped"); }}>Skip and continue</button></div></div></div>}
    </section>
  );
}
