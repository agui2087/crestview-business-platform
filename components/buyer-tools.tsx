"use client";

import { useMemo, useState } from "react";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
}

function Field({ label, value, onChange, suffix = "$" }: { label: string; value: number; onChange: (value: number) => void; suffix?: string }) {
  return <label className="tool-field"><span>{label}</span><div>{suffix === "$" && <b>$</b>}<input type="number" min="0" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix !== "$" && <b>{suffix}</b>}</div></label>;
}

export function BuyerTools({ locale }: { locale: "en" | "es" }) {
  const es = locale === "es";
  const [cash, setCash] = useState(150000);
  const [equityPct, setEquityPct] = useState(15);
  const [fees, setFees] = useState(25000);
  const [workingCapital, setWorkingCapital] = useState(50000);
  const [reserve, setReserve] = useState(30000);
  const budget = useMemo(() => ({ availableEquity: Math.max(0, cash - fees - workingCapital - reserve), purchaseRange: equityPct > 0 ? Math.max(0, cash - fees - workingCapital - reserve) / (equityPct / 100) : 0 }), [cash, equityPct, fees, workingCapital, reserve]);

  const [earnings, setEarnings] = useState(250000);
  const [multiple, setMultiple] = useState(3);
  const [debt, setDebt] = useState(100000);
  const [surplusCash, setSurplusCash] = useState(25000);
  const [adjustment, setAdjustment] = useState(0);
  const valuation = useMemo(() => ({ enterprise: (earnings + adjustment) * multiple, equity: (earnings + adjustment) * multiple - debt + surplusCash }), [earnings, multiple, debt, surplusCash, adjustment]);

  return <div className="buyer-tools">
    <section className="buyer-tool-card"><header><span>01</span><div><h2>{es ? "Estimador de presupuesto" : "Business purchase budget estimator"}</h2><p>{es ? "Calcula un rango preliminar después de reservar gastos y capital de trabajo." : "Estimate a preliminary purchase-price range after reserving fees and working capital."}</p></div></header><div className="tool-form"><Field label={es ? "Efectivo disponible" : "Cash available"} value={cash} onChange={setCash} /><Field label={es ? "Aporte estimado" : "Estimated equity contribution"} value={equityPct} onChange={setEquityPct} suffix="%" /><Field label={es ? "Gastos de cierre y profesionales" : "Closing and professional costs"} value={fees} onChange={setFees} /><Field label={es ? "Capital de trabajo" : "Working capital reserve"} value={workingCapital} onChange={setWorkingCapital} /><Field label={es ? "Reserva personal" : "Personal reserve"} value={reserve} onChange={setReserve} /></div><div className="tool-results"><div><span>{es ? "Disponible para aporte" : "Available for equity"}</span><strong>{money(budget.availableEquity)}</strong></div><div className="is-primary"><span>{es ? "Rango estimado de compra" : "Estimated purchase-price range"}</span><strong>{money(budget.purchaseRange)}</strong></div></div><p className="tool-disclaimer">{es ? "Estimación educativa. Los requisitos reales dependen del prestamista, programa y transacción." : "Educational estimate only. Actual requirements depend on the lender, program, borrower, and transaction."}</p></section>

    <section className="buyer-tool-card"><header><span>02</span><div><h2>{es ? "Estimador de valoración" : "Small-business valuation estimator"}</h2><p>{es ? "Prueba cómo los ingresos normalizados, el múltiplo, la deuda y el efectivo afectan el valor." : "Test how normalized earnings, the multiple, debt, and surplus cash affect estimated value."}</p></div></header><div className="tool-form"><Field label={es ? "SDE o EBITDA" : "Normalized SDE or EBITDA"} value={earnings} onChange={setEarnings} /><Field label={es ? "Ajustes comprobados" : "Supported earnings adjustments"} value={adjustment} onChange={setAdjustment} /><Field label={es ? "Múltiplo" : "Selected multiple"} value={multiple} onChange={setMultiple} suffix="×" /><Field label={es ? "Deuda incluida" : "Debt included"} value={debt} onChange={setDebt} /><Field label={es ? "Efectivo excedente" : "Surplus cash included"} value={surplusCash} onChange={setSurplusCash} /></div><div className="tool-results"><div><span>{es ? "Valor empresarial" : "Estimated enterprise value"}</span><strong>{money(valuation.enterprise)}</strong></div><div className="is-primary"><span>{es ? "Valor del capital" : "Estimated equity value"}</span><strong>{money(valuation.equity)}</strong></div></div><p className="tool-disclaimer">{es ? "No es una valoración profesional. Verifica ingresos, múltiplos, activos, deuda y estructura con asesores calificados." : "This is not a professional valuation. Verify earnings, the multiple, assets, debt, and deal structure with qualified advisers."}</p></section>
  </div>;
}
