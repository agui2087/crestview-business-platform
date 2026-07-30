"use client";

import { useState } from "react";
import { signIn, signUp } from "@/app/[locale]/sign-in/actions";
import type { Locale } from "@/lib/i18n";

export function SupabaseAuth({
  initialMode = "sign-in",
  locale,
  error,
  message,
}: {
  initialMode?: "sign-in" | "create";
  locale: Locale;
  error?: string;
  message?: string;
}) {
  const [mode, setMode] = useState(initialMode);

  return (
    <div className="local-auth">
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button className={`button ${mode === "sign-in" ? "button--primary is-active" : "button--light"}`} type="button" onClick={() => setMode("sign-in")}>Sign in</button>
        <button className={`button ${mode === "create" ? "button--primary is-active" : "button--light"}`} type="button" onClick={() => setMode("create")}>Create account</button>
      </div>
      {message === "check-email" && <p className="auth-success" role="status">Check your email to confirm your account, then return here to sign in.</p>}
      {error && <p className="auth-error" role="alert">{error === "invalid" ? "The email or password is incorrect." : "We could not create that account. It may already exist."}</p>}
      <form action={mode === "create" ? signUp : signIn}>
        <input type="hidden" name="locale" value={locale} />
        {mode === "create" && (
          <>
          <div className="field">
            <label htmlFor="displayName">Your name</label>
            <input id="displayName" name="displayName" autoComplete="name" minLength={2} maxLength={80} required />
            <small>This name appears throughout Crestview, including in personalized broker request drafts.</small>
          </div>
          <fieldset className="role-picker">
            <legend>How will you use Crestview?</legend>
            <label><input type="radio" name="accountRole" value="buyer" defaultChecked /><span><strong>Buyer</strong><small>Browse opportunities, request information, sign NDAs, and review deal documents.</small></span></label>
            <label><input type="radio" name="accountRole" value="broker" /><span><strong>Broker or seller</strong><small>Publish listings, screen buyers, send NDAs, and manage secure deal rooms.</small></span></label>
            <label><input type="radio" name="accountRole" value="advisor" /><span><strong>Advisor</strong><small>Help a buyer organize diligence, documents, decisions, and closing work.</small></span></label>
          </fieldset>
          </>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={8} maxLength={128} required />
          <small>Use at least 8 characters.</small>
        </div>
        {mode === "create" && <div className="account-note"><span aria-hidden="true">i</span><p>Your account is securely managed by Crestview’s authentication provider and works across your devices.</p></div>}
        <button className="button button--primary auth-submit" type="submit">{mode === "create" ? "Create account" : "Sign in"}</button>
        <button className="button button--light auth-switch" type="button" onClick={() => setMode(mode === "create" ? "sign-in" : "create")}>
          {mode === "create" ? "Already have an account? Sign in" : "New to Crestview? Create an account"}
        </button>
      </form>
    </div>
  );
}
