import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { chatGPTSignInHref, getChatGPTUser } from "@/app/chatgpt-auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Sign in",
};
export const dynamic = "force-dynamic";

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { auth } = getDictionary(locale);
  const user = await getChatGPTUser();
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
          <div className="notice">Secure account access is ready. Crestview uses ChatGPT sign-in so it never stores your password.</div>
          {user ? (
            <div className="signed-in-choice">
              <p>Signed in as <strong>{user.email}</strong></p>
              <Link className="button button--primary auth-submit" href={`/${locale}/create-account`}>Continue to Crestview</Link>
            </div>
          ) : (
            <a className="button button--primary auth-submit auth-provider" href={signInHref}>Continue securely with ChatGPT</a>
          )}
          <p className="auth-privacy">After signing in, you’ll choose the name shown throughout Crestview and in any broker message drafts you create.</p>
          <Link className="auth-back" href={`/${locale}`}>{auth.back}</Link>
        </div>
      </section>
    </main>
  );
}
