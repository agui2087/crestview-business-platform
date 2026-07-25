"use client";

import { useMemo, useState } from "react";
import { useCrestviewUser } from "@/components/user-provider";
import type { Opportunity } from "@/lib/demo-data";

const stages = [
  ["Initial screening", "Confirm fit, seller expectations, licenses, and basic financial availability."],
  ["Confidentiality and information request", "Execute the NDA and request financial, operational, customer, employee, and legal records."],
  ["Valuation", "Normalize earnings, test valuation ranges, and identify unsupported adjustments."],
  ["Financing readiness", "Review equity needs, lender fit, debt coverage, working capital, and seller-financing terms."],
  ["Indication of interest or LOI", "Document price, structure, exclusivity, diligence access, contingencies, and timing with counsel."],
  ["Due diligence", "Validate financial, tax, legal, operational, customer, employee, technology, insurance, and compliance claims."],
  ["Definitive agreement and closing", "Finalize allocation, representations, consents, financing, escrow, transition, and closing deliverables."],
  ["Purchase complete", "Confirm funds and documents, transfer control, begin transition, and track post-closing obligations."],
] as const;

function parseNumber(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function AcquisitionPlanner({ opportunity }: { opportunity: Opportunity }) {
  const user = useCrestviewUser();
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [skipOpen, setSkipOpen] = useState(false);
  const [price, setPrice] = useState(opportunity.priceValue?.toString() ?? "");
  const [sde, setSde] = useState(opportunity.cashFlowValue?.toString() ?? "");
  const [ebitda, setEbitda] = useState(opportunity.ebitdaValue?.toString() ?? "");
  const [debtService, setDebtService] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedRequestItems, setSelectedRequestItems] = useState<string[]>(() => [...opportunity.missing]);

  const metrics = useMemo(() => {
    const p = parseNumber(price);
    const s = parseNumber(sde);
    const e = parseNumber(ebitda);
    const d = parseNumber(debtService);
    return {
      priceToSde: p !== null && s ? p / s : null,
      priceToEbitda: p !== null && e ? p / e : null,
      dscr: s !== null && d ? s / d : null,
    };
  }, [price, sde, ebitda, debtService]);

  if (!started) {
    return (
      <section className="begin-panel">
        <div><span>Acquisition workspace</span><h2>Ready to evaluate this opportunity?</h2><p>Start a guided checklist from screening through closing. You can move at your own pace and flag missing information for the seller or broker.</p></div>
        <button className="button button--primary" onClick={() => setStarted(true)}>Begin acquisition</button>
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
        <p>Acquisition checklist</p>
        {stages.map(([title], index) => (
          <button className={index === current ? "is-current" : index < current ? "is-complete" : ""} onClick={() => setCurrent(index)} key={title}>
            <span>{index < current ? "✓" : index + 1}</span>{title}
          </button>
        ))}
      </aside>
      <div className="acquisition-stage">
        <span className="mini-label">Step {current + 1} of {stages.length}</span>
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
          </div>
          <div className="valuation-summary">
            <h3>Calculation summary</h3>
            <div><span>Price ÷ SDE</span><strong>{metrics.priceToSde ? `${metrics.priceToSde.toFixed(2)}×` : "N/A"}</strong></div>
            <div><span>Price ÷ EBITDA</span><strong>{metrics.priceToEbitda ? `${metrics.priceToEbitda.toFixed(2)}×` : "N/A"}</strong></div>
            <div><span>Illustrative debt coverage</span><strong>{metrics.dscr ? `${metrics.dscr.toFixed(2)}×` : "N/A"}</strong></div>
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

        <label className="stage-notes">Notes and evidence<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record what you verified, what is still missing, and who owns the next action." /></label>
        <p className="advisor-note">Crestview provides organizational tools and illustrative calculations, not legal, tax, accounting, lending, or investment advice.</p>
        <div className="stage-actions">
          <button className="button button--light" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))}>Back</button>
          {!atLastStep && <><button className="skip-link" onClick={() => setSkipOpen(true)}>Skip this step</button><button className="button button--primary" onClick={() => setCurrent((value) => Math.min(stages.length - 1, value + 1))}>Mark complete and continue</button></>}
        </div>
      </div>

      {skipOpen && <div className="modal-backdrop" role="presentation"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="skip-title"><span>!</span><h2 id="skip-title">Are you sure you want to skip this step?</h2><p>Missing work can create financial, legal, or operational risk. Crestview will mark this step as skipped so you can return later.</p><div><button className="button button--light" onClick={() => setSkipOpen(false)}>Keep working</button><button className="button button--primary" onClick={() => { setSkipOpen(false); setCurrent((value) => Math.min(stages.length - 1, value + 1)); }}>Skip and continue</button></div></div></div>}
    </section>
  );
}
