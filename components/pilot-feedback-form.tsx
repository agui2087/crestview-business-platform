"use client";

import { FormEvent, useState } from "react";
import { usePathname } from "next/navigation";

export function PilotFeedbackForm({ locale }: { locale: "en" | "es" }) {
  const es = locale === "es";
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/pilot/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          route: pathname,
          taskArea: form.get("taskArea"),
          sentiment: form.get("sentiment"),
          comments: form.get("comments"),
          contactPermission: form.get("contactPermission") === "on",
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save feedback.");
      event.currentTarget.reset();
      setMessage(es ? "Gracias. Tus comentarios se guardaron." : "Thank you. Your feedback was saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (es ? "No se pudieron guardar los comentarios." : "Feedback could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return <form className="pilot-feedback-form panel" onSubmit={submit}>
    <div><label htmlFor="pilot-task-area">{es ? "¿Qué estabas intentando hacer?" : "What were you trying to do?"}</label><select id="pilot-task-area" name="taskArea" required defaultValue=""><option value="" disabled>{es ? "Selecciona una opción" : "Select one"}</option><option value="search">{es ? "Buscar negocios" : "Search businesses"}</option><option value="listing">{es ? "Revisar o crear un anuncio" : "Review or create a listing"}</option><option value="nda">NDA</option><option value="documents">{es ? "Documentos" : "Documents"}</option><option value="dashboard">Dashboard</option><option value="billing">{es ? "Facturación" : "Billing"}</option><option value="other">{es ? "Otro" : "Other"}</option></select></div>
    <fieldset><legend>{es ? "¿Cómo se sintió?" : "How did it feel?"}</legend><div className="pilot-sentiment-options">{[["blocked",es?"Bloqueado":"Blocked"],["difficult",es?"Difícil":"Difficult"],["neutral",es?"Neutral":"Neutral"],["easy",es?"Fácil":"Easy"]].map(([value,label])=><label key={value}><input type="radio" name="sentiment" value={value} required/>{label}</label>)}</div></fieldset>
    <label htmlFor="pilot-comments">{es ? "Cuéntanos qué pasó" : "Tell us what happened"}<textarea id="pilot-comments" name="comments" rows={6} maxLength={2000} required/></label>
    <label className="pilot-consent"><input type="checkbox" name="contactPermission"/>{es ? "Puedes contactarme para hacer seguimiento." : "You may contact me to follow up."}</label>
    <button className="button button--primary" disabled={busy}>{busy ? (es ? "Enviando…" : "Sending…") : (es ? "Enviar comentarios" : "Send feedback")}</button>
    <p className="pilot-feedback-message" role="status" aria-live="polite">{message}</p>
  </form>;
}
