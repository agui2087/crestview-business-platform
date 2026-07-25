import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { getDictionary, isLocale } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signIn, signUp } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);
  const configured = isSupabaseConfigured();

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Brand locale={locale} inverse />
        <div className="auth-quote">
          <p>“{auth.quote}”</p>
          <span>{auth.attribution}</span>
        </div>
      </aside>
      <section className="auth-main" aria-labelledby="sign-in-title">
        <div className="auth-card">
          <h1 id="sign-in-title">{auth.title}</h1>
          <p className="auth-card__intro">{auth.body}</p>
          <div className="notice">{configured ? "Secure account access is connected." : auth.notice}</div>
          <form action={signIn}>
            <input type="hidden" name="locale" value={locale} />
            <div className="field">
              <label htmlFor="email">{auth.email}</label>
              <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" disabled={!configured} required />
            </div>
            <div className="field">
              <label htmlFor="password">{auth.password}</label>
              <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" disabled={!configured} minLength={8} required />
            </div>
            <button className="button button--primary auth-submit" type="submit" disabled={!configured}>
              {auth.submit}
            </button>
            <button className="auth-create" formAction={signUp} disabled={!configured} type="submit">Create an account</button>
          </form>
          <Link className="auth-back" href={`/${locale}`}>{auth.back}</Link>
        </div>
      </section>
    </main>
  );
}
