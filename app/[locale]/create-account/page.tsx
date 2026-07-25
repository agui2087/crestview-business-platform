import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LocalAuth } from "@/components/local-auth";
import { getChatGPTUser, chatGPTSignInHref, isLocalRequest } from "@/app/chatgpt-auth";
import { isLocale } from "@/lib/i18n";
import { createProfile } from "./actions";

export const metadata: Metadata = { title: "Create your Crestview account" };
export const dynamic = "force-dynamic";

export default async function CreateAccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const local = await isLocalRequest();
  if (local) {
    return (
      <main className="auth-page">
        <aside className="auth-aside">
          <Brand locale={locale} inverse />
          <div className="auth-quote"><p>“Build locally. Learn quickly. Keep every decision clear.”</p><span>Crestview local workspace</span></div>
        </aside>
        <section className="auth-main" aria-labelledby="local-create-title">
          <div className="auth-card">
            <span className="mini-label">Local account</span>
            <h1 id="local-create-title">Create your Crestview account</h1>
            <p className="auth-card__intro">This account works on your local Crestview site without ChatGPT.</p>
            <LocalAuth initialMode="create" returnTo={`/${locale}/dashboard`} />
          </div>
        </section>
      </main>
    );
  }
  const user = await getChatGPTUser();
  if (!user) redirect(await chatGPTSignInHref(`/${locale}/create-account`));

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Brand locale={locale} inverse />
        <div className="auth-quote">
          <p>“A clear acquisition process starts with work that belongs to you.”</p>
          <span>Welcome to Crestview</span>
        </div>
      </aside>
      <section className="auth-main" aria-labelledby="create-account-title">
        <div className="auth-card">
          <span className="mini-label">One last step</span>
          <h1 id="create-account-title">Create your Crestview profile</h1>
          <p className="auth-card__intro">You are securely signed in as {user.email}.</p>
          <form action={createProfile}>
            <input type="hidden" name="locale" value={locale} />
            <div className="field">
              <label htmlFor="displayName">Your name</label>
              <input id="displayName" name="displayName" autoComplete="name" defaultValue={user.fullName ?? ""} placeholder="Geovannia Flores" minLength={2} maxLength={80} required />
              <small>This name appears throughout Crestview, including personalized broker request drafts and your account profile.</small>
            </div>
            <div className="account-note"><span aria-hidden="true">i</span><p>You can change your display name later in Settings. Crestview will never add it to a message without showing you the complete draft first.</p></div>
            <button className="button button--primary auth-submit" type="submit">Create account and continue</button>
          </form>
        </div>
      </section>
    </main>
  );
}
