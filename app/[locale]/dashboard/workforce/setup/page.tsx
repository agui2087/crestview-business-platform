import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlatformShell, PageHeading } from "@/components/platform-shell";
import { isLocale } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { workforceOperation } from "../operations/actions";
import "../operations/workforce-operations.css";

type Location={id:string;name:string;country_code:string;region:string;timezone:string;archived:boolean;version:number};
type Department={id:string;name:string;archived:boolean;version:number};
export default async function WorkforceSetup({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{owner?:string;notice?:string}>}) {
  const {locale}=await params;if(!isLocale(locale))notFound();
  const t=(en:string,es:string)=>locale==="es"?es:en;
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
  const query=await searchParams;const owner=query.owner||user.id;
  const access=await db.rpc("workforce_role",{p_owner:owner});
  const admin=access.data==="owner"||access.data==="hr";
  if(!admin)return <PlatformShell locale={locale} active="workforce"><p>{t("Business setup requires owner or HR access.","La configuración requiere acceso de propietario o RR. HH.")}</p></PlatformShell>;
  const [businessResult,locationsResult,departmentsResult]=await Promise.all([
    db.from("workforce_business_settings").select("business_name,timezone,version").eq("owner_id",owner).maybeSingle(),
    db.from("workforce_locations").select("id,name,country_code,region,timezone,archived,version").eq("owner_id",owner).order("name").limit(500),
    db.from("workforce_departments").select("id,name,archived,version").eq("owner_id",owner).order("name").limit(500),
  ]);
  const failed=access.error||businessResult.error||locationsResult.error||departmentsResult.error;
  const business=businessResult.data;const locations=(locationsResult.data??[]) as Location[],departments=(departmentsResult.data??[]) as Department[];
  const hidden=(operation:string,id?:string,version=0)=><><input type="hidden" name="locale" value={locale}/><input type="hidden" name="owner" value={owner}/><input type="hidden" name="operation" value={operation}/><input type="hidden" name="version" value={version}/>{id&&<input type="hidden" name="id" value={id}/>}</>;
  const availability=(archived=false)=><label>{t("Availability","Disponibilidad")}<select name="archived" defaultValue={String(archived)}><option value="false">{t("Active","Activa")}</option><option value="true">{t("Archived","Archivada")}</option></select></label>;
  const zone=(value?:string)=><label>{t("Time zone (IANA, for example America/Los_Angeles)","Zona horaria IANA, por ejemplo America/Los_Angeles")}<input name="timezone" defaultValue={value??""} required maxLength={100} list="wf-timezones"/></label>;
  const locationForm=(l?:Location)=><form action={workforceOperation}>{hidden("location",l?.id,l?.version)}<label>{t("Location name","Nombre de ubicación")}<input name="name" defaultValue={l?.name} maxLength={200} required/></label><label>{t("Country code (two letters)","Código de país (dos letras)")}<input name="country" defaultValue={l?.country_code} minLength={2} maxLength={2} pattern="[A-Za-z]{2}" required/></label><label>{t("State / province / region","Estado / provincia / región")}<input name="region" defaultValue={l?.region} required maxLength={200}/></label>{zone(l?.timezone)}{availability(l?.archived)}<button>{t("Save location","Guardar ubicación")}</button></form>;
  const departmentForm=(d?:Department)=><form action={workforceOperation}>{hidden("department",d?.id,d?.version)}<label>{t("Department name","Nombre del departamento")}<input name="name" defaultValue={d?.name} required maxLength={200}/></label>{availability(d?.archived)}<button>{t("Save department","Guardar departamento")}</button></form>;
  return <PlatformShell locale={locale} active="workforce"><div className="dashboard-content wf-ops">
    <PageHeading eyebrow={t("Your business","Tu empresa")} title={t("Workforce business setup","Configuración de personal")} body={t("Configure this workspace without changing another business or assuming its leave rules.","Configura este espacio sin cambiar otra empresa ni asumir sus políticas de ausencia.")} action={<Link href={`/${locale}/dashboard/workforce/operations?owner=${owner}`}>{t("Command center","Centro de operaciones")}</Link>}/>
    {query.notice&&<p role={query.notice==="saved"?"status":"alert"}>{query.notice==="saved"?t("Saved successfully.","Guardado correctamente."):t("Not saved. Check required fields and access, then refresh before retrying a stale edit.","No se guardó. Revisa campos y acceso; actualiza antes de reintentar un cambio obsoleto.")}</p>}
    {failed?<p role="alert">{t("Setup could not load. Refresh before making changes.","No se pudo cargar la configuración. Actualiza antes de cambiar datos.")}</p>:<>
      <section className="panel"><h2>{t("Business identity","Identidad de la empresa")}</h2><form action={workforceOperation}>{hidden("business",undefined,business?.version)}<label>{t("Business name","Nombre de la empresa")}<input name="name" defaultValue={business?.business_name} required maxLength={200}/></label>{zone(business?.timezone)}<button>{t("Save business","Guardar empresa")}</button></form></section>
      <datalist id="wf-timezones">{['UTC','America/Los_Angeles','America/Denver','America/Chicago','America/New_York','Europe/London','Europe/Madrid','America/Mexico_City'].map(z=><option key={z} value={z}/>)}</datalist>
      <section className="panel"><h2>{t("Work locations","Ubicaciones de trabajo")}</h2><p>{t("Record actual work locations, including remote locations. This does not activate legal rules, holidays or leave entitlements.","Registra ubicaciones reales, incluidas remotas. Esto no activa reglas legales, festivos ni derechos de ausencia.")}</p>{locations.map(l=><details key={l.id}><summary>{l.name} · {l.region} {l.archived?t("· Archived","· Archivada"):""}</summary>{locationForm(l)}</details>)}<details><summary>{t("Add location","Agregar ubicación")}</summary>{locationForm()}</details></section>
      <section className="panel"><h2>{t("Departments","Departamentos")}</h2><p>{t("This catalog does not rename existing employee records. Employee-to-location and department linking is a separate setup step.","Este catálogo no renombra registros de empleados. La vinculación de empleados a ubicaciones y departamentos es un paso separado.")}</p>{departments.map(d=><details key={d.id}><summary>{d.name} {d.archived?t("· Archived","· Archivado"):""}</summary>{departmentForm(d)}</details>)}<details><summary>{t("Add department","Agregar departamento")}</summary>{departmentForm()}</details></section>
      {(locations.length>=500||departments.length>=500)&&<p role="status">{t("A display limit was reached; this may not be the complete catalog.","Se alcanzó un límite; el catálogo puede estar incompleto.")}</p>}
      <section className="panel"><h2>{t("Policy and schedule readiness","Preparación de políticas y horarios")}</h2><p>{t("Leave calculations and work schedules are not configured by this screen. Keep existing employer policies in effect until their replacement is reviewed and adopted. Manager access is configured in the command center.","Esta pantalla no configura cálculos de ausencia ni horarios. Conserva las políticas existentes hasta revisar y adoptar sus reemplazos. El acceso de gerentes se configura en el centro de operaciones.")}</p></section>
    </>}
  </div></PlatformShell>;
}
