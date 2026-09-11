import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { PasswordRecovery } from "@/components/password-recovery";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password", robots: { index: false, follow: false } };
export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  const { error } = await searchParams;
  let authenticated = false;
  if (!error && isSupabaseConfigured()) {
    const client = await createSupabaseServerClient();
    const { data, error: authError } = await client.auth.getUser();
    authenticated = !authError && Boolean(data.user);
  }
  return <main className="auth-page"><aside className="auth-aside"><Brand locale={locale} inverse /></aside><section className="auth-main" aria-labelledby="reset-title"><div className="auth-card">
    <h1 id="reset-title">{es ? "Elegir nueva contraseña" : "Choose a new password"}</h1>
    {authenticated ? <PasswordRecovery locale={locale} reset /> : <><p role="alert">{es ? "El enlace falta, venció o ya se usó. Solicita uno nuevo y ábrelo en el mismo navegador donde lo solicitaste." : "The recovery link is missing, expired, or already used. Request a new one and open it in the same browser where you requested it."}</p><Link className="button button--primary" href={`/${locale}/recover-password`}>{es ? "Solicitar nuevo enlace" : "Request a new link"}</Link></>}
    <Link className="auth-back" href={`/${locale}/sign-in`}>{es ? "Volver a iniciar sesión" : "Back to sign in"}</Link>
  </div></section></main>;
}
