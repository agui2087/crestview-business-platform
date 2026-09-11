"use client";

import { useActionState } from "react";
import { completePasswordRecovery, requestPasswordRecovery } from "@/app/[locale]/recover-password/actions";

export function PasswordRecovery({ locale, reset = false }: { locale: string; reset?: boolean }) {
  const es = locale === "es";
  const [status, action, pending] = useActionState(reset ? completePasswordRecovery : requestPasswordRecovery, "");
  const messages: Record<string, string> = es ? {
    sent: "Si existe una cuenta con ese correo, recibirás un enlace de recuperación. Revisa también la carpeta de spam. Abre el enlace en este mismo navegador y dispositivo.",
    "invalid-email": "Ingresa un correo electrónico válido.",
    "rate-limited": "Espera unos minutos antes de solicitar otro enlace.",
    unavailable: "La recuperación no está disponible temporalmente. Inténtalo más tarde.",
    "invalid-password": "Usa entre 8 y 128 caracteres y confirma la misma contraseña.",
    expired: "La sesión venció. Solicita un nuevo enlace de recuperación.",
    "password-rejected": "No se pudo actualizar la contraseña. Usa una contraseña distinta y segura; si el enlace venció, solicita otro.",
    updated: "Contraseña actualizada. Cierra sesión antes de iniciar sesión de nuevo.",
  } : {
    sent: "If an account exists for that email, you’ll receive a recovery link. Check your spam folder too. Open the link in this same browser and device.",
    "invalid-email": "Enter a valid email address.",
    "rate-limited": "Wait a few minutes before requesting another link.",
    unavailable: "Password recovery is temporarily unavailable. Please try again later.",
    "invalid-password": "Use 8–128 characters and enter the same password in both fields.",
    expired: "Your session expired. Request a new recovery link.",
    "password-rejected": "The password could not be updated. Use a different, strong password; if the link expired, request another.",
    updated: "Password updated. Sign out before signing in again.",
  };
  return <form action={action} className="local-auth">
    <input type="hidden" name="locale" value={locale} />
    {reset ? <>
      <div className="field"><label htmlFor="new-password">{es ? "Nueva contraseña" : "New password"}</label><input id="new-password" type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required /></div>
      <div className="field"><label htmlFor="confirm-password">{es ? "Confirmar contraseña" : "Confirm password"}</label><input id="confirm-password" type="password" name="confirmation" autoComplete="new-password" minLength={8} maxLength={128} required /></div>
      <p>{es ? "Usa una contraseña única de al menos 8 caracteres." : "Use a unique password of at least 8 characters."}</p>
    </> : <div className="field"><label htmlFor="recovery-email">{es ? "Correo electrónico" : "Email"}</label><input id="recovery-email" type="email" name="email" autoComplete="email" maxLength={254} required /></div>}
    {status && <p role={status === "sent" || status === "updated" ? "status" : "alert"}>{messages[status]}</p>}
    <button className="button button--primary auth-submit" disabled={pending || status === "sent" || status === "updated"} type="submit">{pending ? (es ? "Procesando…" : "Working…") : reset ? (es ? "Actualizar contraseña" : "Update password") : (es ? "Enviar enlace de recuperación" : "Send recovery link")}</button>
    {status === "expired" && <a href={`/${locale}/recover-password`}>{es ? "Solicitar otro enlace" : "Request another link"}</a>}
  </form>;
}
