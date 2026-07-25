"use client";

import { FormEvent, useState } from "react";

type StoredAccount = {
  email: string;
  fullName: string;
  passwordHash: string;
};

const STORAGE_KEY = "crestview_local_accounts";

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function readAccounts(): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredAccount[];
  } catch {
    return [];
  }
}

function startLocalSession(account: StoredAccount, returnTo: string) {
  const value = encodeURIComponent(JSON.stringify({ email: account.email, fullName: account.fullName }));
  document.cookie = `crestview_local_user=${value}; Path=/; Max-Age=2592000; SameSite=Lax`;
  window.location.assign(returnTo);
}

export function LocalAuth({ initialMode = "sign-in", returnTo = "/en/dashboard" }: { initialMode?: "sign-in" | "create"; returnTo?: string }) {
  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = readAccounts();
    const passwordHash = await hashPassword(password);

    if (mode === "create") {
      if (fullName.trim().length < 2) {
        setError("Enter the name you want displayed throughout Crestview.");
        setBusy(false);
        return;
      }
      if (accounts.some((account) => account.email === normalizedEmail)) {
        setError("A local account already uses this email. Choose Sign in instead.");
        setBusy(false);
        return;
      }
      const account = { email: normalizedEmail, fullName: fullName.trim(), passwordHash };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...accounts, account]));
      startLocalSession(account, returnTo);
      return;
    }

    const account = accounts.find((item) => item.email === normalizedEmail && item.passwordHash === passwordHash);
    if (!account) {
      setError("The email or password does not match a local Crestview account.");
      setBusy(false);
      return;
    }
    startLocalSession(account, returnTo);
  }

  return (
    <div className="local-auth">
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button className={mode === "sign-in" ? "is-active" : ""} type="button" onClick={() => { setMode("sign-in"); setError(""); }}>Sign in</button>
        <button className={mode === "create" ? "is-active" : ""} type="button" onClick={() => { setMode("create"); setError(""); }}>Create account</button>
      </div>
      <form onSubmit={submit}>
        {mode === "create" && <div className="field"><label htmlFor="local-name">Your name</label><input id="local-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /><small>This name appears throughout Crestview, including personalized broker request drafts and your account profile.</small></div>}
        <div className="field"><label htmlFor="local-email">Email</label><input id="local-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@company.com" required /></div>
        <div className="field"><label htmlFor="local-password">Password</label><input id="local-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={8} required /><small>Use at least 8 characters.</small></div>
        {mode === "create" && <div className="account-note"><span aria-hidden="true">i</span><p>Your local account stays in this browser on this computer. It is intended for developing and testing Crestview locally.</p></div>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button--primary auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "create" ? "Create local account" : "Sign in locally"}</button>
      </form>
    </div>
  );
}
