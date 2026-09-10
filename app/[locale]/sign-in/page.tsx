import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { LocalAuth } from "@/components/local-auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SupabaseAuth } from "@/components/supabase-auth";
import { chatGPTSignInHref, getChatGPTUser, isStandaloneRequest } from "@/app/chatgpt-auth";
import { getDictionary, isLocale } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isLocalAuthenticationAllowed } from "@/lib/auth-environment";
import { authReturnPath } from "@/lib/auth-return-path";

export const metadata: Metadata = {
  title: "Sign in",
};
export const dynamic = "force-dynamic";

export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const returnTo = authReturnPath(query.return_to, locale);
  const { auth } = getDictionary(locale);
  const user = await getChatGPTUser();
  const standalone = await isStandaloneRequest();
  const signInHref = await chatGPTSignInHref(`/${locale}/create-account`);

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Brand locale={locale} inverse />
        <LocaleSwitcher locale={locale} inverse />
        <div className="auth-quote">
          <p>“{auth.quote}”</p>
          <span>{auth.attribution}</span>
        </div>
      </aside>
      <section className="auth-main" aria-labelledby="sign-in-title">
        <div className="auth-card">
          <h1 id="sign-in-title">{auth.title}</h1>
          <p className="auth-card__intro">{auth.body}</p>
          <div className="notice">{es ? "Crea tu cuenta de Crestview o inicia sesión para continuar." : "Create or sign in to your Crestview account to continue."}</div>
          {standalone && !user && isSupabaseConfigured() ? (
            <SupabaseAuth locale={locale} returnTo={returnTo} error={typeof query.error === "string" ? query.error : undefined} message={typeof query.message === "string" ? query.message : undefined} />
          ) : standalone && !user && isLocalAuthenticationAllowed() ? (
            <LocalAuth returnTo={returnTo} />
          ) : standalone && !user ? (
            <p role="alert">{es ? "El acceso seguro no está disponible temporalmente. Inténtalo de nuevo más tarde." : "Secure sign-in is temporarily unavailable. Please try again later."}</p>
          ) : user ? (
            <div className="signed-in-choice">
              <p>{es ? "Sesión iniciada como" : "Signed in as"} <strong>{user.email}</strong></p>
              <Link className="button button--primary auth-submit" href={returnTo}>{es ? "Continuar a tu espacio de trabajo" : "Continue to your workspace"}</Link>
            </div>
          ) : (
            <a className="button button--primary auth-submit auth-provider" href={signInHref}>Continue securely with ChatGPT</a>
          )}
          {!standalone && <p className="auth-privacy">After signing in, you’ll choose the name shown throughout Crestview and in any broker message drafts you create.</p>}
          <Link className="auth-back" href={`/${locale}`}>{auth.back}</Link>
        </div>
      </section>
    </main>
  );
}
