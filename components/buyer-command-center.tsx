import Link from "next/link";
import { estimateBuyerRange } from "@/lib/buyer-finance";
import { calculateBuyerFit, type BuyerFitPreferences } from "@/lib/deal-score";
import { opportunities } from "@/lib/demo-data";

type Profile = NonNullable<BuyerFitPreferences> & {
  desired_owner_income: number | null;
  acquisition_timeline: string | null;
  funding_status: string | null;
  experience_level: string | null;
  buyer_summary: string | null;
};

type Finance = { available_cash: number | null; buyer_injection_percent: number; illustrative_interest_rate: number } | null;

export function BuyerCommandCenter({ locale, profile, finance, activeDeals, openTasks }: { locale: string; profile: Profile | null; finance: Finance; activeDeals: number; openTasks: number }) {
  const es = locale === "es";
  const completed = [profile?.industries.length, profile?.locations.length, profile?.desired_owner_income, profile?.acquisition_timeline, profile?.funding_status, profile?.experience_level, profile?.buyer_summary, finance?.available_cash].filter(Boolean).length;
  const readiness = Math.round((completed / 8) * 100);
  const estimate = finance?.available_cash ? estimateBuyerRange({ availableCash: finance.available_cash, desiredOwnerIncome: profile?.desired_owner_income ?? 0, injectionPercent: finance.buyer_injection_percent, interestRate: finance.illustrative_interest_rate }) : null;
  const matches = profile ? opportunities.map((item) => ({ item, fit: calculateBuyerFit(item, profile) })).filter((entry) => entry.fit).sort((a,b) => (b.fit?.score ?? 0) - (a.fit?.score ?? 0)).slice(0,3) : [];
  const money = new Intl.NumberFormat(es ? "es-US" : "en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 });
  const nextStep = !finance?.available_cash ? (es ? "Guardar efectivo disponible y supuestos" : "Save your available cash and assumptions") : !profile?.industries.length ? (es ? "Elegir industrias preferidas" : "Choose preferred industries") : !profile?.locations.length ? (es ? "Elegir ubicaciones preferidas" : "Choose preferred locations") : openTasks ? (es ? "Completar tu próxima tarea" : "Complete your next open task") : (es ? "Revisar tus mejores coincidencias" : "Review your strongest matches");

  return <section className="buyer-command-center">
    <header><div><span>{es ? "CENTRO DEL COMPRADOR" : "BUYER COMMAND CENTER"}</span><h2>{es ? "Tu camino hacia la propiedad" : "Your path to business ownership"}</h2><p>{es ? "Rango, preparación, coincidencias y próximos pasos en un solo lugar." : "Buying range, readiness, matches, and next actions in one place."}</p></div><Link href={`/${locale}/dashboard/settings#listing-alerts`}>{es ? "Actualizar perfil →" : "Update buyer profile →"}</Link></header>
    <div className="buyer-command-metrics">
      <div><span>{es ? "Preparación del perfil" : "Profile readiness"}</span><strong>{readiness}%</strong><i><b style={{width:`${readiness}%`}} /></i></div>
      <div><span>{es ? "Rango estimado" : "Estimated buying range"}</span><strong>{estimate ? money.format(estimate.maxPurchasePrice) : (es ? "Completar perfil" : "Complete profile")}</strong><small>{es ? "Estimación educativa" : "Educational estimate"}</small></div>
      <div><span>{es ? "Adquisiciones activas" : "Active acquisitions"}</span><strong>{activeDeals}</strong><small>{openTasks} {es ? "tareas abiertas" : "open tasks"}</small></div>
      <div className="is-next"><span>{es ? "Mejor próximo paso" : "Best next step"}</span><strong>{nextStep}</strong><Link href={!finance?.available_cash || !profile?.industries.length || !profile?.locations.length ? `/${locale}/dashboard/settings#listing-alerts` : `/${locale}/dashboard/opportunities`}>{es ? "Continuar →" : "Continue →"}</Link></div>
    </div>
    {matches.length > 0 && <div className="buyer-command-matches"><div><strong>{es ? "Mejores coincidencias actuales" : "Strongest current matches"}</strong><span>{es ? "Basado en tu perfil guardado" : "Based on your saved criteria"}</span></div>{matches.map(({item,fit}) => <Link href={`/${locale}/dashboard/opportunities/${item.id}`} key={item.id}><span>{fit?.score}%</span><div><strong>{item.title}</strong><small>{item.location} · {item.price}</small></div><b>→</b></Link>)}</div>}
  </section>;
}
