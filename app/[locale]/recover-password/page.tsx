import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { PasswordRecovery } from "@/components/password-recovery";
import { isLocale } from "@/lib/i18n";

export const metadata = { title: "Recover password", robots: { index: false, follow: false } };
export default async function RecoverPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const es = locale === "es";
  return <main className="auth-page"><aside className="auth-aside"><Brand locale={locale} inverse /></aside><section className="auth-main" aria-labelledby="recovery-title"><div className="auth-card">
    <h1 id="recovery-title">{es ? "Recuperar contraseña" : "Recover your password"}</h1>
    <p>{es ? "Ingresa el correo de tu cuenta de Crestview. Te enviaremos un enlace seguro para elegir una nueva contraseña." : "Enter your Crestview account email. We’ll send a secure link to choose a new password."}</p>
    <PasswordRecovery locale={locale} />
    <Link className="auth-back" href={`/${locale}/sign-in`}>{es ? "Volver a iniciar sesión" : "Back to sign in"}</Link>
  </div></section></main>;
}
