import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeading, PlatformShell } from "@/components/platform-shell";
import { getCrestviewUser } from "@/lib/current-user";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Summary = {
  users: number;
  confirmed_users: number;
  saved_opportunities: number;
  employees: number;
  open_tasks: number;
  recent_users: Array<{ email:string; display_name:string|null; created_at:string; last_sign_in_at:string|null; confirmed:boolean }>;
};

export default async function AdminPage({ params }: { params: Promise<{ locale:string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const user = await getCrestviewUser(locale);
  if (user.email.toLowerCase() !== "agui2087@outlook.com") redirect(`/${locale}/dashboard`);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_admin_summary");
  if (error) throw new Error("Admin information could not be loaded.");
  const summary = data as Summary;
  const es = locale === "es";
  return <PlatformShell locale={locale} active="overview"><div className="dashboard-content admin-dashboard">
    <PageHeading eyebrow={es ? "Vista del propietario" : "Owner view"} title={es ? "Administración de Crestview" : "Crestview administration"} body={es ? "Actividad de la plataforma. Las contraseñas nunca son visibles." : "Platform activity and account health. User passwords are never visible."} action={<Link className="button button--light" href={`/${locale}/dashboard`}>{es ? "Cambiar a vista de usuario" : "Switch to user view"}</Link>}/>
    <div className="metric-grid">{[
      [es?"Usuarios":"Users",summary.users],[es?"Confirmados":"Confirmed",summary.confirmed_users],[es?"Oportunidades guardadas":"Saved opportunities",summary.saved_opportunities],[es?"Empleados":"Employees",summary.employees],[es?"Tareas abiertas":"Open tasks",summary.open_tasks],
    ].map(([label,value])=><article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <section className="panel admin-users"><div className="panel__header"><h2>{es ? "Cuentas recientes" : "Recent accounts"}</h2><span>{summary.recent_users.length}</span></div>
      {summary.recent_users.map((account)=><article key={account.email}><div><strong>{account.display_name ?? "No name provided"}</strong><span>{account.email}</span></div><span>{account.confirmed ? (es?"Confirmado":"Confirmed") : (es?"Pendiente":"Pending")}</span><span>{new Date(account.created_at).toLocaleDateString(locale)}</span><span>{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleDateString(locale) : (es?"Nunca":"Never")}</span></article>)}
    </section>
  </div></PlatformShell>;
}
