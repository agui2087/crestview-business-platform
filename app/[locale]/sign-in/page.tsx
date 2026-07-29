import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { LocalAuth } from "@/components/local-auth";
import { SupabaseAuth } from "@/components/supabase-auth";
import { chatGPTSignInHref, getChatGPTUser, isStandaloneRequest } from "@/app/chatgpt-auth";
import { getDictionary, isLocale } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/server";

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
  const { auth } = getDictionary(locale);
  const user = await getChatGPTUser();
  const standalone = await isStandaloneRequest();
  const signInHref = await chatGPTSignInHref(`/${locale}/create-account`);

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
          <div className="notice">{standalone ? "Create or sign in to your Crestview account to continue." : "Secure account access is ready."}</div>
          {standalone && !user && isSupabaseConfigured() ? (
            <SupabaseAuth locale={locale} error={typeof query.error === "string" ? query.error : undefined} message={typeof query.message === "string" ? query.message : undefined} />
          ) : standalone && !user ? (
            <LocalAuth returnTo={`/${locale}/dashboard`} />
          ) : user ? (
            <div className="signed-in-choice">
              <p>Signed in as <strong>{user.email}</strong></p>
              <Link className="button button--primary auth-submit" href={`/${locale}/dashboard`}>Continue to your dashboard</Link>
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
