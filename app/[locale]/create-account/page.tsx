import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { LocalAuth } from "@/components/local-auth";
import { SupabaseAuth } from "@/components/supabase-auth";
import { isStandaloneRequest } from "@/app/chatgpt-auth";
import { isLocale } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { isLocalAuthenticationAllowed } from "@/lib/auth-environment";

export const metadata: Metadata = { title: "Create your Crestview account" };
export const dynamic = "force-dynamic";

export default async function CreateAccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const standalone = await isStandaloneRequest();
  if (standalone) {
    return (
      <main className="auth-page">
        <aside className="auth-aside">
          <Brand locale={locale} inverse />
          <div className="auth-quote"><p>“Build with clarity. Move with confidence. Keep every decision connected.”</p><span>Welcome to Crestview</span></div>
        </aside>
        <section className="auth-main" aria-labelledby="local-create-title">
          <div className="auth-card">
            <span className="mini-label">Your account</span>
            <h1 id="local-create-title">Create your Crestview account</h1>
            <p className="auth-card__intro">Create your account directly with Crestview and keep your acquisition workspace connected.</p>
            {isSupabaseConfigured() ? <SupabaseAuth initialMode="create" locale={locale} /> : isLocalAuthenticationAllowed() ? <LocalAuth initialMode="create" returnTo={`/${locale}/dashboard`} /> : <p className="account-note">Account creation is temporarily unavailable because secure authentication is not configured.</p>}
          </div>
        </section>
      </main>
    );
  }
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const siteUrl = configuredSiteUrl?.startsWith("https://")
    ? configuredSiteUrl.replace(/\/$/, "")
    : "https://www.crestviewplatform.com";
  const secureSignInUrl = `${siteUrl}/${locale}/sign-in?return_to=${encodeURIComponent(`/${locale}/dashboard`)}`;

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
          <span className="mini-label">Secure Crestview account</span>
          <h1 id="create-account-title">Continue on Crestview</h1>
          <p className="auth-card__intro">Buyer and broker accounts now use Crestview&apos;s secure, unified sign-in system.</p>
          <div className="account-note"><span aria-hidden="true">i</span><p>Your listings, saved opportunities, messages, and documents stay connected to one account on the official Crestview domain.</p></div>
          <a className="button button--primary auth-submit" href={secureSignInUrl}>Continue securely</a>
        </div>
      </section>
    </main>
  );
}
