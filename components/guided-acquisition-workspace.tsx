import { calculateSbaReadiness, readinessSummary, type GuidanceProfile } from "@/lib/guided-acquisition";
import {
  buildCommandCenter, findDocumentConflicts, formatReviewStatus, formatSupportLevel,
  passportMetrics, type DocumentFinding,
} from "@/lib/deal-intelligence";
import {
  addDealProfessional, addDiligenceEvidence, addDocumentFinding, generateGuidedPlan,
  saveSbaReadiness, updateTransitionItem,
} from "@/app/[locale]/dashboard/opportunities/actions";

type Diligence = {
  id: string; category: string; title: string; status: string; reason: string | null;
  guidance_source: string; source_url: string | null; risk_level: string; assigned_role: string | null;
};
type Evidence = { id: string; diligence_item_id: string; label: string; evidence_type: string; source_url: string | null; verification_status: string };
type Professional = { id: string; role: string; display_name: string; organization: string | null; responsibility: string | null; status: string };
type Transition = { id: string; horizon: string; category: string; title: string; owner: string | null; status: string };
type Sba = { purchase_price: number; buyer_injection: number; seller_note: number; working_capital: number; annual_cash_flow: number; interest_rate: number; term_years: number; lender_status: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function GuidedAcquisitionWorkspace({
  locale, opportunityKey, industry, defaultPrice, defaultCashFlow, missingInformation,
  listingCompleteness, profile, diligence, evidence, professionals, transition, sba, findings, hasPro,
}: {
  locale: string; opportunityKey: string; industry: string; defaultPrice: number; defaultCashFlow: number;
  missingInformation: number; listingCompleteness: number;
  profile: GuidanceProfile | null; diligence: Diligence[]; evidence: Evidence[]; professionals: Professional[];
  transition: Transition[]; sba: Sba | null; findings: DocumentFinding[]; hasPro: boolean;
}) {
  const es = locale === "es";
  const readiness = readinessSummary(diligence);
  const model = calculateSbaReadiness(sba ?? {
    purchase_price: defaultPrice, buyer_injection: defaultPrice * .1, seller_note: 0, working_capital: 0,
    annual_cash_flow: defaultCashFlow, interest_rate: 10.5, term_years: 10,
  });
  const t = es ? {
    eyebrow: "Plan guiado", title: "Tu espacio de adquisición", body: "Personaliza el plan una vez. Crestview organiza las tareas, pruebas, riesgos, asesores, financiamiento y transición en un solo lugar.",
    personalize: "Personalizar este plan", generate: "Generar o actualizar plan", readiness: "Preparación de la operación",
    complete: "verificado", evidence: "con evidencia", risks: "riesgos altos abiertos", transparent: "Cómo se calcula",
    diligence: "Plan y evidencia", why: "Por qué importa", addEvidence: "Conectar evidencia", source: "Fuente",
    sba: "Preparación SBA", collaborators: "Equipo profesional", transition: "Plan de transición",
  } : {
    eyebrow: "Guided plan", title: "Your acquisition workspace", body: "Personalize the plan once. Crestview organizes tasks, evidence, risks, advisors, financing, and transition in one place.",
    personalize: "Personalize this plan", generate: "Generate or update plan", readiness: "Deal readiness",
    complete: "verified", evidence: "with evidence", risks: "open high risks", transparent: "How this is calculated",
    diligence: "Plan and evidence", why: "Why it matters", addEvidence: "Connect evidence", source: "Source",
    sba: "SBA readiness", collaborators: "Professional team", transition: "Transition plan",
  };
  const evidenceByItem = new Map<string, Evidence[]>();
  evidence.forEach((item) => evidenceByItem.set(item.diligence_item_id, [...(evidenceByItem.get(item.diligence_item_id) ?? []), item]));
  const conflicts = findDocumentConflicts(findings);
  const command = buildCommandCenter({
    diligence, evidenceCount: evidence.length, professionalsCount: professionals.length,
    transition, lenderStatus: sba?.lender_status ?? null, findings, locale: es ? "es" : "en",
  });
  const { documentSupportedClaims, reviewConfirmedClaims } = passportMetrics({
    findings, evidenceCount: evidence.length,
  });

  return <section className="guided-workspace" id="guided-plan">
    <header className="guided-workspace__hero">
      <div><span>{t.eyebrow}</span><h2>{t.title}</h2><p>{t.body}</p></div>
      <div className="readiness-dial" aria-label={`${readiness.progress}% ready`}><strong>{readiness.progress}%</strong><span>{es ? "listo" : "ready"}</span></div>
    </header>

    <section className="command-center">
      <div className="command-center__next"><span>{es ? "PRÓXIMA MEJOR ACCIÓN" : "NEXT BEST ACTION"}</span><h3>{command.nextAction}</h3><p>{es ? "Crestview prioriza conflictos de documentos, evidencia recibida y riesgos altos antes de tareas de menor impacto." : "Crestview prioritizes document conflicts, received evidence, and high risks before lower-impact work."}</p></div>
      <div className="command-center__metrics">
        <div className={command.conflicts ? "is-alert" : ""}><strong>{command.conflicts}</strong><span>{es ? "conflictos" : "conflicts"}</span></div>
        <div><strong>{command.openHighRisk}</strong><span>{es ? "riesgos altos" : "high risks"}</span></div>
        <div><strong>{command.received}</strong><span>{es ? "para verificar" : "to verify"}</span></div>
        <div><strong>{command.evidenceCount}</strong><span>{es ? "evidencias" : "evidence"}</span></div>
      </div>
      <div className="command-center__status">
        <span>{es ? "Prestamista" : "Lender"}</span><strong>{command.lenderStatusLabel}</strong>
        <span>{es ? "Equipo" : "Team"}</span><strong>{command.professionalsCount} {es ? "profesionales" : "professionals"}</strong>
      </div>
    </section>

    <section className="listing-passport">
      <header><div><span>{es ? "PASAPORTE DE CONFIANZA" : "VERIFIED LISTING PASSPORT"}</span><h3>{es ? "Qué sabemos y cómo lo sabemos" : "What is known—and how it is supported"}</h3></div><b>{listingCompleteness}% {es ? "completo" : "complete"}</b></header>
      <div className="passport-grid">
        <div><span>{es ? "Proporcionado por corredor" : "Broker/listing reported"}</span><strong>{listingCompleteness}%</strong><small>{es ? "Datos del anuncio público; no verificados por Crestview." : "Public listing fields; not independently verified by Crestview."}</small></div>
        <div><span>{es ? "Respaldado por documentos" : "Document supported"}</span><strong>{documentSupportedClaims}</strong><small>{es ? "Evidencia o hallazgos enlazados a una fuente identificada." : "Evidence or findings linked to an identified source."}</small></div>
        <div><span>{es ? "Revisión confirmada" : "Review confirmed"}</span><strong>{reviewConfirmedClaims}</strong><small>{es ? "Hallazgos con estado de revisión confirmado; no incluye tareas completadas del checklist." : "Findings with a confirmed review status; completed checklist tasks are not counted here."}</small></div>
        <div className={missingInformation ? "is-missing" : ""}><span>{es ? "Aún falta" : "Still missing"}</span><strong>{missingInformation}</strong><small>{es ? "Preguntas importantes no respondidas en el anuncio." : "Important questions not answered by the listing."}</small></div>
      </div>
      <p>{es ? "El pasaporte muestra procedencia y estado; no garantiza que una afirmación sea correcta. Confirma información material con documentos y asesores apropiados." : "The passport shows provenance and status; it does not guarantee a claim is correct. Confirm material information with source documents and appropriate advisors."}</p>
    </section>

    <details className="guided-panel plan-builder" open={!profile}>
      <summary><span>1</span><div><strong>{t.personalize}</strong><small>{es ? "Responde preguntas simples para obtener tareas específicas." : "Answer simple questions to get deal-specific tasks."}</small></div></summary>
      <form action={generateGuidedPlan} className="guided-form">
        <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunityKey}/>
        <label>{es ? "Tipo de negocio" : "Business type"}<input name="industry_type" defaultValue={profile?.industry_type ?? industry}/></label>
        <label>{es ? "Estructura de compra" : "Purchase structure"}<select name="purchase_structure" defaultValue={profile?.purchase_structure ?? "asset"}><option value="asset">{es ? "Compra de activos" : "Asset purchase"}</option><option value="stock">{es ? "Compra de entidad/acciones" : "Entity/stock purchase"}</option><option value="undecided">{es ? "Aún no decidido" : "Not decided"}</option></select></label>
        <label>{es ? "Financiamiento" : "Financing"}<select name="financing_type" defaultValue={profile?.financing_type ?? "sba"}><option value="sba">SBA 7(a)</option><option value="conventional">{es ? "Préstamo convencional" : "Conventional loan"}</option><option value="seller">{es ? "Financiamiento del vendedor" : "Seller financing"}</option><option value="cash">{es ? "Efectivo" : "Cash"}</option><option value="undecided">{es ? "Aún no decidido" : "Not decided"}</option></select></label>
        <label>{es ? "Estado" : "State"}<input name="state_code" maxLength={2} defaultValue={profile?.state_code ?? "OR"}/></label>
        <fieldset className="guided-checks">
          <label><input type="checkbox" name="has_employees" defaultChecked={profile?.has_employees ?? true}/>{es ? "Tiene empleados" : "Has employees"}</label>
          <label><input type="checkbox" name="includes_real_estate" defaultChecked={profile?.includes_real_estate}/>{es ? "Incluye inmueble" : "Includes real estate"}</label>
          <label><input type="checkbox" name="includes_inventory" defaultChecked={profile?.includes_inventory}/>{es ? "Incluye inventario" : "Includes inventory"}</label>
          <label><input type="checkbox" name="first_acquisition" defaultChecked={profile?.first_acquisition ?? true}/>{es ? "Primera adquisición" : "First acquisition"}</label>
        </fieldset>
        <button className="button button--primary">{t.generate}</button>
      </form>
    </details>

    <section className="readiness-panel">
      <header><span>2</span><div><strong>{t.readiness}</strong><small>{t.transparent}</small></div></header>
      <div className="readiness-metrics">
        <div><strong>{readiness.completed}/{readiness.total}</strong><span>{t.complete}</span></div>
        <div><strong>{readiness.evidenceProgress}%</strong><span>{t.evidence}</span></div>
        <div className={readiness.highRisks ? "is-warning" : ""}><strong>{readiness.highRisks}</strong><span>{t.risks}</span></div>
      </div>
      <p>{es ? "La preparación cuenta tareas verificadas ÷ tareas aplicables. “Con evidencia” incluye documentos recibidos o verificados. Los riesgos altos permanecen abiertos hasta verificarse." : "Readiness is verified tasks ÷ applicable tasks. “With evidence” includes received or verified records. High risks remain open until verified."}</p>
    </section>

    <section className={`financial-workbook-card ${hasPro ? "is-pro" : "is-locked"}`}>
      <div className="financial-workbook-card__copy">
        <span>{es ? "CALCULADORA FINANCIERA" : "FINANCIAL DUE DILIGENCE"}</span>
        <h3>{es ? "Convierte los números del vendedor en una decisión auditable" : "Turn seller numbers into an auditable decision"}</h3>
        <p>{es ? "Ingresa tres años y los últimos doce meses. El archivo calcula SDE y EBITDA normalizados, capital de trabajo, servicio de deuda, DSCR, valoración, concentración de clientes y escenarios adversos." : "Enter three years and trailing-twelve-month figures. The workbook calculates normalized SDE and EBITDA, working capital, debt service, DSCR, valuation, customer concentration, and downside scenarios."}</p>
        <ul>
          <li>{es ? "Celdas de entrada claramente marcadas" : "Clearly marked input cells"}</li>
          <li>{es ? "Panel, alertas y verificaciones automáticas" : "Automatic dashboard, warnings, and model checks"}</li>
          <li>{es ? "Checklist de documentos y fuentes oficiales" : "Document checklist and official reference sources"}</li>
        </ul>
      </div>
      <div className="financial-workbook-card__action">
        <b>PRO</b>
        {hasPro ? <>
          <a className="button button--primary" href="/api/export/financial-due-diligence">{es ? "Descargar calculadora Excel" : "Download Excel calculator"}</a>
          <small>{es ? "Incluido con tu membresía Pro activa." : "Included with your active Pro membership."}</small>
        </> : <>
          <a className="button button--primary" href={`/${locale}/pricing#buyer-pricing`}>{es ? "Desbloquear con Pro" : "Unlock with Pro"}</a>
          <small>{es ? "Vista previa disponible; descarga protegida por membresía." : "Preview what it covers; the download is membership protected."}</small>
        </>}
      </div>
      <footer>{es ? "Herramienta educativa de organización. Confirma los resultados con documentos fuente y asesores calificados." : "Educational organization tool. Confirm results with source documents and qualified advisors."}</footer>
    </section>

    <details className="guided-panel" open>
      <summary><span>3</span><div><strong>{t.diligence}</strong><small>{es ? "Cada requisito explica su motivo, fuente, riesgo y responsable." : "Every requirement shows its reason, source, risk, and owner."}</small></div></summary>
      <div className="guided-task-list">
        {diligence.map((item) => <article className="guided-task" key={item.id}>
          <div className="guided-task__top"><div><span>{item.category} · {item.assigned_role ?? "buyer"}</span><strong>{item.title}</strong></div><b className={`risk-badge risk-badge--${item.risk_level}`}>{item.risk_level} {es ? "riesgo" : "risk"}</b></div>
          <p><b>{t.why}:</b> {item.reason ?? (es ? "Agregado por el comprador para revisión." : "Buyer-added item for review.")}</p>
          <div className="source-line"><span>{t.source}: {item.guidance_source}</span>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">{es ? "Ver fuente oficial ↗" : "View official source ↗"}</a>}<span>{es ? "Estado" : "Status"}: {item.status}</span></div>
          {(evidenceByItem.get(item.id) ?? []).map((proof) => <div className="evidence-chip" key={proof.id}>✓ {proof.label} · {proof.evidence_type} · {proof.verification_status}{proof.source_url && <a href={proof.source_url} target="_blank" rel="noreferrer"> ↗</a>}</div>)}
          <details className="evidence-add"><summary>+ {t.addEvidence}</summary><form action={addDiligenceEvidence}>
            <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunityKey}/><input type="hidden" name="diligence_item_id" value={item.id}/>
            <select name="evidence_type"><option value="document">{es ? "Documento del trato" : "Deal document"}</option><option value="public_record">{es ? "Registro público" : "Public record"}</option><option value="professional_note">{es ? "Nota profesional" : "Professional note"}</option><option value="buyer_note">{es ? "Nota del comprador" : "Buyer note"}</option></select>
            <input name="label" required placeholder={es ? "Nombre del documento o evidencia" : "Document or evidence name"}/>
            <input name="source_url" type="url" placeholder={es ? "Enlace opcional" : "Optional link"}/><button>{es ? "Conectar" : "Connect"}</button>
          </form></details>
        </article>)}
        {!diligence.length && <div className="guided-empty">{es ? "Personaliza el plan para crear tu lista específica." : "Personalize the plan to create your deal-specific checklist."}</div>}
      </div>
    </details>

    <section className={`document-intelligence ${hasPro ? "is-pro" : "is-locked"}`}>
      <header><div><span>{es ? "INTELIGENCIA DOCUMENTAL" : "DOCUMENT INTELLIGENCE"}</span><h3>{es ? "Convierte documentos en afirmaciones comprobables" : "Turn documents into traceable deal facts"}</h3><p>{es ? "Cada hallazgo conserva el documento fuente, periodo, valor y estado de revisión." : "Every finding keeps its source document, period, value, and review status."}</p></div><b>PRO</b></header>
      {hasPro ? <>
        <div className="finding-summary">
          <div><strong>{findings.length}</strong><span>{es ? "hallazgos" : "findings"}</span></div>
          <div className={conflicts.length ? "is-alert" : ""}><strong>{conflicts.length}</strong><span>{es ? "discrepancias" : "discrepancies"}</span></div>
          <div><strong>{findings.filter((item) => item.review_status === "confirmed").length}</strong><span>{es ? "revisión confirmada" : "review confirmed"}</span></div>
        </div>
        {conflicts.map((group) => <article className="conflict-card" key={`${group[0].metric_name}-${group[0].period_label}`}>
          <span>{es ? "REVISIÓN NECESARIA" : "REVIEW NEEDED"}</span><strong>{group[0].metric_name} · {group[0].period_label ?? (es ? "periodo actual" : "current period")}</strong>
          <p>{group.map((item) => `${item.source_document}: ${item.reported_value}`).join(" · ")}</p>
        </article>)}
        <div className="finding-list">{findings.map((finding) => <article key={finding.id}>
          <div><span>{finding.metric_name} · {finding.period_label ?? (es ? "sin periodo" : "no period")}</span><strong>{finding.reported_value}</strong></div>
          <div><span>{finding.source_document}</span><small>{formatSupportLevel(finding.confidence, es ? "es" : "en")} · {formatReviewStatus(finding.review_status, es ? "es" : "en")}</small></div>
          {finding.source_url && <a href={finding.source_url} target="_blank" rel="noreferrer">{es ? "Abrir fuente ↗" : "Open source ↗"}</a>}
        </article>)}</div>
        <details className="finding-form"><summary>+ {es ? "Registrar hallazgo de documento" : "Record a document finding"}</summary><form action={addDocumentFinding}>
          <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunityKey}/>
          <label>{es ? "Documento fuente" : "Source document"}<input name="source_document" required placeholder={es ? "Ej. declaración fiscal 2025" : "e.g. 2025 tax return"}/></label>
          <label>{es ? "Métrica o afirmación" : "Metric or claim"}<input name="metric_name" required placeholder={es ? "Ej. ingresos" : "e.g. revenue"}/></label>
          <label>{es ? "Valor mostrado" : "Displayed value"}<input name="reported_value" required placeholder="$850,000"/></label>
          <label>{es ? "Valor numérico opcional" : "Optional numeric value"}<input name="normalized_value" type="number" step=".01" placeholder="850000"/></label>
          <label>{es ? "Periodo" : "Period"}<input name="period_label" placeholder="2025"/></label>
          <label>{es ? "Tipo de fuente" : "Source type"}<select name="confidence"><option value="document_supported">{es ? "Respaldado por documento" : "Document supported"}</option><option value="buyer_entered">{es ? "Ingresado por comprador" : "Buyer entered"}</option></select></label>
          <label className="span-two">{es ? "Enlace seguro opcional" : "Optional secure link"}<input name="source_url" type="url"/></label>
          <label className="span-two">{es ? "Notas" : "Notes"}<textarea name="notes"/></label>
          <button className="button button--primary">{es ? "Guardar hallazgo" : "Save finding"}</button>
        </form></details>
      </> : <div className="pro-lock">
        <span>◇</span><h4>{es ? "La ejecución esencial permanece gratis" : "Essential execution stays free"}</h4>
        <p>{es ? "Pro agrega extracción estructurada, comparación entre documentos, alertas de discrepancias y explicaciones avanzadas. El checklist, pasaporte básico, tareas y progreso siguen disponibles gratis." : "Pro adds structured findings, cross-document comparisons, discrepancy alerts, and advanced explanations. The checklist, basic passport, tasks, and progress remain free."}</p>
        <a className="button button--primary" href={`/${locale}/pricing#buyer-pricing`}>{es ? "Ver Crestview Pro" : "See Crestview Pro"}</a>
      </div>}
      <footer>{es ? "Crestview ayuda a organizar y comparar información; no certifica documentos ni reemplaza la revisión profesional." : "Crestview helps organize and compare information; it does not certify documents or replace professional review."}</footer>
    </section>

    <div className="guided-two-column">
      <details className="guided-panel" open>
        <summary><span>4</span><div><strong>{t.sba}</strong><small>{es ? "Estimación transparente, no aprobación de préstamo." : "Transparent estimate, not a loan approval."}</small></div></summary>
        <form action={saveSbaReadiness} className="finance-form">
          <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunityKey}/>
          <label>{es ? "Precio" : "Purchase price"}<input name="purchase_price" type="number" min="0" defaultValue={sba?.purchase_price ?? defaultPrice}/></label>
          <label>{es ? "Aporte del comprador" : "Buyer injection"}<input name="buyer_injection" type="number" min="0" defaultValue={sba?.buyer_injection ?? Math.round(defaultPrice * .1)}/></label>
          <label>{es ? "Nota del vendedor" : "Seller note"}<input name="seller_note" type="number" min="0" defaultValue={sba?.seller_note ?? 0}/></label>
          <label>{es ? "Capital de trabajo" : "Working capital"}<input name="working_capital" type="number" min="0" defaultValue={sba?.working_capital ?? 0}/></label>
          <label>{es ? "Flujo anual disponible" : "Annual available cash flow"}<input name="annual_cash_flow" type="number" min="0" defaultValue={sba?.annual_cash_flow ?? defaultCashFlow}/></label>
          <label>{es ? "Tasa estimada %" : "Estimated rate %"}<input name="interest_rate" type="number" min="0" step=".1" defaultValue={sba?.interest_rate ?? 10.5}/></label>
          <label>{es ? "Plazo (años)" : "Term (years)"}<input name="term_years" type="number" min="1" max="25" defaultValue={sba?.term_years ?? 10}/></label>
          <label>{es ? "Estado con prestamista" : "Lender status"}<select name="lender_status" defaultValue={sba?.lender_status ?? "not_started"}><option value="not_started">{es ? "No iniciado" : "Not started"}</option><option value="preparing">{es ? "Preparando" : "Preparing"}</option><option value="prequalified">{es ? "Precalificado" : "Prequalified"}</option><option value="submitted">{es ? "Enviado" : "Submitted"}</option><option value="approved">{es ? "Aprobado" : "Approved"}</option></select></label>
          <button>{es ? "Guardar escenario" : "Save scenario"}</button>
        </form>
        <div className="finance-results"><div><span>{es ? "Préstamo estimado" : "Estimated loan"}</span><strong>{money.format(model.loan)}</strong></div><div><span>{es ? "Servicio anual de deuda" : "Annual debt service"}</span><strong>{money.format(model.annualDebt)}</strong></div><div className={model.dscr >= 1.25 ? "is-good" : "is-warning"}><span>DSCR</span><strong>{model.dscr.toFixed(2)}x</strong></div><div><span>{es ? "Aporte" : "Injection"}</span><strong>{model.injectionPercent.toFixed(1)}%</strong></div></div>
        <p className="guided-disclaimer">{es ? "Cálculo: préstamo = precio + capital de trabajo − aporte − nota del vendedor. DSCR = flujo anual ÷ servicio anual estimado. Confirma elegibilidad, tasa, aporte y estructura con un prestamista SBA." : "Formula: loan = price + working capital − injection − seller note. DSCR = annual cash flow ÷ estimated annual debt service. Confirm eligibility, rate, injection, and structure with an SBA lender."} <a href="https://www.sba.gov/funding-programs/loans/7a-loans" target="_blank" rel="noreferrer">SBA.gov ↗</a></p>
      </details>

      <details className="guided-panel" open>
        <summary><span>5</span><div><strong>{t.collaborators}</strong><small>{es ? "Define quién revisa qué; no compartimos archivos automáticamente." : "Define who reviews what; files are not shared automatically."}</small></div></summary>
        <form action={addDealProfessional} className="professional-form">
          <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunityKey}/>
          <select name="role"><option value="attorney">{es ? "Abogado" : "Attorney"}</option><option value="accountant">{es ? "Contador" : "Accountant"}</option><option value="lender">{es ? "Prestamista" : "Lender"}</option><option value="insurance">{es ? "Seguro" : "Insurance"}</option><option value="broker">Broker</option><option value="consultant">{es ? "Consultor" : "Consultant"}</option></select>
          <input name="display_name" required placeholder={es ? "Nombre" : "Name"}/><input name="organization" placeholder={es ? "Organización" : "Organization"}/><input name="responsibility" placeholder={es ? "Qué revisará" : "What they will review"}/><button>{es ? "Agregar" : "Add"}</button>
        </form>
        <div className="professional-list">{professionals.map((person) => <article key={person.id}><span>{person.role} · {person.status}</span><strong>{person.display_name}</strong><p>{person.organization ?? person.responsibility ?? (es ? "Responsabilidad por definir" : "Responsibility to be defined")}</p></article>)}</div>
        <p className="guided-disclaimer">{es ? "Crestview organiza la colaboración, pero no reemplaza asesoría legal, fiscal, contable, crediticia o de seguros." : "Crestview organizes collaboration but does not replace legal, tax, accounting, lending, or insurance advice."}</p>
      </details>
    </div>

    <details className="guided-panel transition-panel" open>
      <summary><span>6</span><div><strong>{t.transition}</strong><small>{es ? "El trabajo continúa después del cierre con un plan 30/60/90." : "The work continues after closing with a 30/60/90-day plan."}</small></div></summary>
      <div className="transition-list">{transition.map((item) => <article key={item.id}><div><span>{item.horizon.replaceAll("_", " ")} · {item.category}</span><strong>{item.title}</strong></div><form action={updateTransitionItem}>
        <input type="hidden" name="locale" value={locale}/><input type="hidden" name="opportunity_key" value={opportunityKey}/><input type="hidden" name="id" value={item.id}/>
        <input name="owner" defaultValue={item.owner ?? ""} placeholder={es ? "Responsable" : "Owner"}/><select name="status" defaultValue={item.status}><option value="open">{es ? "Abierto" : "Open"}</option><option value="in_progress">{es ? "En curso" : "In progress"}</option><option value="complete">{es ? "Completo" : "Complete"}</option></select><button>{es ? "Guardar" : "Save"}</button>
      </form></article>)}</div>
    </details>

    <footer className="guided-language-note"><span>7</span><p>{es ? "Esta experiencia completa está disponible en español y conserva tu idioma preferido en futuras visitas." : "This complete experience is available in English and Spanish and remembers your preferred language on future visits."}</p></footer>
  </section>;
}
