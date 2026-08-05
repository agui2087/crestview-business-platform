"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { estimateBuyerRange } from "@/lib/buyer-finance";

function numeric(value: string) {
  return Math.max(0, Number(value.replace(/[$,\s]/g, "")) || 0);
}

export function BuyerFitCalculator({ locale, savedAvailableCash, savedDesiredIncome, savedInjectionPercent, savedInterestRate }: { locale: string; savedAvailableCash?: number | null; savedDesiredIncome?: number | null; savedInjectionPercent?: number | null; savedInterestRate?: number | null }) {
  const es = locale === "es";
  const [cash, setCash] = useState(String(savedAvailableCash ?? 100000));
  const [income, setIncome] = useState(String(savedDesiredIncome ?? 90000));
  const [downPayment, setDownPayment] = useState(String(savedInjectionPercent ?? 15));
  const [rate, setRate] = useState(String(savedInterestRate ?? 11));

  const estimate = useMemo(() => {
    return estimateBuyerRange({ availableCash: numeric(cash), desiredOwnerIncome: numeric(income), injectionPercent: numeric(downPayment), interestRate: numeric(rate) });
  }, [cash, income, downPayment, rate]);

  const money = new Intl.NumberFormat(es ? "es-US" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return <section className="buyer-fit-tool" aria-labelledby="buyer-fit-title">
    <header>
      <div><span>{es ? "ESTIMADOR GRATUITO" : "FREE BUYER FIT ESTIMATE"}</span><h2 id="buyer-fit-title">{es ? "¿Qué tipo de negocio podría comprar?" : "What kind of business could I realistically buy?"}</h2><p>{es ? "Usa tus propios números para crear un rango inicial antes de buscar." : "Use your own numbers to create a practical starting range before you search."}</p></div>
      <Link href={`/${locale}/dashboard/settings#listing-alerts`}>{es ? "Guardar en mi perfil →" : "Save preferences in my profile →"}</Link>
    </header>
    <div className="buyer-fit-grid">
      <div className="buyer-fit-inputs">
        <label>{es ? "Efectivo disponible" : "Cash available"}<input value={cash} onChange={(event) => setCash(event.target.value)} inputMode="numeric" aria-label={es ? "Efectivo disponible" : "Cash available"} /></label>
        <label>{es ? "Ingreso anual deseado" : "Desired annual owner income"}<input value={income} onChange={(event) => setIncome(event.target.value)} inputMode="numeric" aria-label={es ? "Ingreso anual deseado" : "Desired annual owner income"} /></label>
        <label>{es ? "Aporte inicial estimado" : "Estimated buyer injection"}<select value={downPayment} onChange={(event) => setDownPayment(event.target.value)}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option></select></label>
        <label>{es ? "Tasa estimada" : "Illustrative interest rate"}<select value={rate} onChange={(event) => setRate(event.target.value)}><option value="9">9%</option><option value="10">10%</option><option value="11">11%</option><option value="12">12%</option><option value="13">13%</option></select></label>
      </div>
      <div className="buyer-fit-results" aria-live="polite">
        <div><span>{es ? "Rango máximo ilustrativo" : "Illustrative maximum purchase price"}</span><strong>{money.format(estimate.maxPurchasePrice)}</strong><small>{es ? "Incluye una reserva de 5% para capital de trabajo." : "Includes a 5% working-capital reserve."}</small></div>
        <div><span>{es ? "Flujo de caja mínimo sugerido" : "Suggested minimum annual cash flow"}</span><strong>{money.format(estimate.suggestedMinimumCashFlow)}</strong><small>{es ? "Ingreso deseado más 1.25× el servicio de deuda estimado." : "Desired income plus 1.25× estimated annual debt service."}</small></div>
        <div><span>{es ? "Servicio anual estimado" : "Estimated annual debt service"}</span><strong>{money.format(estimate.annualDebtService)}</strong><small>{es ? "Plazo ilustrativo de 10 años; no es una cotización." : "Illustrative 10-year term; this is not a loan quote."}</small></div>
      </div>
    </div>
    <p className="buyer-fit-disclaimer">{es ? "Estimación educativa solamente. La elegibilidad, el aporte, la tasa, el flujo de caja aceptado y los términos dependen del prestamista y de la operación. Confirma todo con un prestamista calificado." : "Educational estimate only. Eligibility, injection, rate, accepted cash flow, and terms depend on the lender and transaction. Confirm the structure with a qualified lender."}</p>
  </section>;
}
