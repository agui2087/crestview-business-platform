"use client";

import { useEffect, useState } from "react";

const alertOptions = [
  ["new_match", "New matches", "A listing fits your saved budget, location, industry, and cash-flow targets."],
  ["price_change", "Price changes", "The asking price changes on a saved or matched listing."],
  ["financials", "Financials available", "A broker approves access or adds requested records."],
  ["listing_status", "Listing status", "A saved listing is under offer, nearing removal, sold, or withdrawn."],
  ["broker_response", "Broker responses", "A broker replies, sends an NDA, or requests more information."],
  ["checklist", "Checklist reminders", "A due-diligence task is due or waiting on evidence."],
] as const;

export function BuyerAlertPreferences({ locale }: { locale: string }) {
  const es = locale === "es";
  const [selected, setSelected] = useState<string[]>(["new_match", "financials", "broker_response"]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("crestview-alert-preferences");
      if (stored) setSelected(JSON.parse(stored) as string[]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function save() {
    window.localStorage.setItem("crestview-alert-preferences", JSON.stringify(selected));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return <section className="settings-panel alert-preferences">
    <div><span>{es ? "Alertas guardadas" : "Saved search alerts"}</span><h2>{es ? "Avísame solo cuando importe" : "Notify me only when it matters"}</h2><p>{es ? "Tus filtros de comprador definen las coincidencias. Elige qué cambios deben aparecer en tu bandeja." : "Your buyer filters define a match. Choose which changes should appear in your deal inbox."}</p></div>
    <div className="alert-option-grid">
      {alertOptions.map(([key, title, description]) => <label key={key}>
        <input type="checkbox" checked={selected.includes(key)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))}/>
        <span><strong>{title}</strong><small>{description}</small></span>
      </label>)}
    </div>
    <div className="alert-save-row"><button className="button button--primary" type="button" onClick={save}>{es ? "Guardar alertas" : "Save alert preferences"}</button>{saved && <span role="status">✓ {es ? "Guardado en este dispositivo" : "Saved on this device"}</span>}</div>
  </section>;
}
