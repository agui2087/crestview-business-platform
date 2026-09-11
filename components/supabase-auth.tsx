"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp } from "@/app/[locale]/sign-in/actions";
import type { Locale } from "@/lib/i18n";

export function SupabaseAuth({
  initialMode = "sign-in",
  locale,
  error,
  message,
  returnTo,
}: {
  initialMode?: "sign-in" | "create";
  locale: Locale;
  error?: string;
  message?: string;
  returnTo?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const es = locale === "es";

  return (
    <div className="local-auth">
      <div className="auth-tabs" role="group" aria-label={es ? "Acceso a la cuenta" : "Account access"}>
        <button className={`button ${mode === "sign-in" ? "button--primary is-active" : "button--light"}`} type="button" onClick={() => setMode("sign-in")}>{es ? "Iniciar sesión" : "Sign in"}</button>
        <button className={`button ${mode === "create" ? "button--primary is-active" : "button--light"}`} type="button" onClick={() => setMode("create")}>{es ? "Crear cuenta" : "Create account"}</button>
      </div>
      {message === "check-email" && <p className="auth-success" role="status">{es ? "Revisa tu correo para confirmar tu cuenta y vuelve aquí para iniciar sesión." : "Check your email to confirm your account, then return here to sign in."}</p>}
      {message === "password-updated" && <p className="auth-success" role="status">{es ? "Contraseña actualizada. Inicia sesión con tu nueva contraseña." : "Password updated. Sign in with your new password."}</p>}
      {error && <p className="auth-error" role="alert">{error === "invalid" ? (es ? "El correo o la contraseña son incorrectos." : "The email or password is incorrect.") : (es ? "No pudimos crear la cuenta. Es posible que ya exista." : "We could not create that account. It may already exist.")}</p>}
      <form action={mode === "create" ? signUp : signIn}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="return_to" value={returnTo ?? `/${locale}/dashboard`} />
        {mode === "create" && (
          <>
          <div className="field">
            <label htmlFor="displayName">{es ? "Tu nombre" : "Your name"}</label>
            <input id="displayName" name="displayName" autoComplete="name" minLength={2} maxLength={80} required />
            <small>{es ? "Este nombre aparece en Crestview y en los borradores de solicitudes a intermediarios." : "This name appears throughout Crestview, including in personalized broker request drafts."}</small>
          </div>
          <fieldset className="role-picker">
            <legend>{es ? "¿Cómo usarás Crestview?" : "How will you use Crestview?"}</legend>
            <label><input type="radio" name="accountRole" value="buyer" defaultChecked /><span><strong>{es ? "Comprador" : "Buyer"}</strong><small>{es ? "Explora oportunidades, solicita información, firma acuerdos de confidencialidad y revisa documentos." : "Browse opportunities, request information, sign NDAs, and review deal documents."}</small></span></label>
            <label><input type="radio" name="accountRole" value="broker" /><span><strong>{es ? "Intermediario o vendedor" : "Broker or seller"}</strong><small>{es ? "Publica negocios, evalúa compradores, envía acuerdos de confidencialidad y administra espacios seguros." : "Publish listings, screen buyers, send NDAs, and manage secure deal rooms."}</small></span></label>
            <label><input type="radio" name="accountRole" value="advisor" /><span><strong>{es ? "Asesor" : "Advisor"}</strong><small>{es ? "Ayuda al comprador a organizar la diligencia, los documentos, las decisiones y el cierre." : "Help a buyer organize diligence, documents, decisions, and closing work."}</small></span></label>
          </fieldset>
          </>
        )}
        <div className="field">
          <label htmlFor="email">{es ? "Correo electrónico" : "Email"}</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
        </div>
        <div className="field">
          <label htmlFor="password">{es ? "Contraseña" : "Password"}</label>
          <input id="password" name="password" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={8} maxLength={128} required />
          <small>{es ? "Usa al menos 8 caracteres." : "Use at least 8 characters."}</small>
        </div>
        {mode === "create" && <div className="account-note"><span aria-hidden="true">i</span><p>{es ? "El proveedor de autenticación de Crestview protege tu cuenta para acceder desde tus dispositivos." : "Your account is securely managed by Crestview’s authentication provider and works across your devices."}</p></div>}
        <AuthSubmit mode={mode} locale={locale} />
        {mode === "sign-in" && <a className="auth-back" href={`/${locale}/recover-password`}>{es ? "¿Olvidaste tu contraseña?" : "Forgot password?"}</a>}
        <button className="button button--light auth-switch" type="button" onClick={() => setMode(mode === "create" ? "sign-in" : "create")}>
          {mode === "create" ? (es ? "¿Ya tienes cuenta? Inicia sesión" : "Already have an account? Sign in") : (es ? "¿Nuevo en Crestview? Crea una cuenta" : "New to Crestview? Create an account")}
        </button>
      </form>
    </div>
  );
}

function AuthSubmit({mode,locale}:{mode:"create"|"sign-in";locale:Locale}) {
  const {pending}=useFormStatus();
  return <button className="button button--primary auth-submit" type="submit" disabled={pending} aria-disabled={pending}>{pending ? (locale === "es" ? "Procesando…" : "Working…") : mode === "create" ? (locale === "es" ? "Crear cuenta" : "Create account") : (locale === "es" ? "Iniciar sesión" : "Sign in")}</button>;
}
