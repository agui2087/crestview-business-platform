import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import '../operations/workforce-operations.css';

type Reminder={source_id:string;kind:string;title:string;employee_id:string;employee_name:string;due_on:string|null;business_today:string;business_timezone:string;total_count:number};
export default async function Reminders({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{owner?:string}>}) {
  const {locale}=await params;if(!isLocale(locale))notFound();const t=(en:string,es:string)=>locale==='es'?es:en;
  const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
  const q=await searchParams,owner=q.owner||user.id,path=`/${locale}/dashboard/workforce/operations?owner=${encodeURIComponent(owner)}`;
  const result=await db.rpc('workforce_reminders',{p_owner:owner});
  const rows=(result.data??[]) as Reminder[];
  const labels:Record<string,string>={overdue_task:t('Your overdue task','Tu tarea vencida'),upcoming_task:t('Your task due within 7 days','Tu tarea vence en 7 días'),review_leave:t('Leave request to review','Solicitud de ausencia por revisar'),review_profile:t('Profile change to review','Cambio de perfil por revisar'),verify_task:t('Training or task awaiting verification','Capacitación o tarea pendiente de verificación'),renewal:t('Certification expired or expiring within 30 days','Certificación vencida o que vence en 30 días')};
  return <PlatformShell locale={locale} active="workforce"><div className="dashboard-content wf-ops"><PageHeading eyebrow={t('People operations','Operaciones de personal')} title={t('My Workforce reminders','Mis recordatorios de personal')} body={t('Current reminders for this workspace and your access.','Recordatorios actuales de este espacio según tu acceso.')} action={<Link href={path}>{t('Command center','Centro de operaciones')}</Link>}/>
    <p>{t('This page refreshes reminders when you open or reload it. It does not send email, text messages or push notifications. Completed or verified work drops out automatically. Dates use the configured business time zone, or UTC if none is configured.','Los recordatorios se actualizan al abrir o recargar esta página. No se envían correos, mensajes de texto ni notificaciones push. Las tareas completadas o verificadas desaparecen automáticamente. Las fechas usan la zona horaria de la empresa, o UTC si no está configurada.')}</p>
    <a className="button button--light" href={`/${locale}/dashboard/workforce/reminders?owner=${encodeURIComponent(owner)}`}>{t('Refresh reminders','Actualizar recordatorios')}</a>
    {result.error?<p role="alert">{t('Reminders could not load. Check workspace access and try again; this is not an empty queue.','No se pudieron cargar los recordatorios. Revisa el acceso e inténtalo de nuevo; esto no significa que la lista esté vacía.')}</p>:<>{!rows.length?<p role="status">{t('No reminders match your current assignments and review access.','No hay recordatorios para tus asignaciones y acceso de revisión actuales.')}</p>:<><p>{t('As of','Al')} {rows[0].business_today} ({rows[0].business_timezone}). {t('Showing','Mostrando')} {rows.length} {t('of','de')} {rows[0].total_count}.</p>{rows.map(r=><section className="panel" key={`${r.kind}:${r.source_id}`}><p>{labels[r.kind]}</p><h2>{r.title}</h2><p>{r.employee_name}</p>{r.due_on&&<p>{r.kind.startsWith('review_')?t('Request starts','Inicio de solicitud'):t('Due / expiry date','Fecha de vencimiento')}: {r.due_on}</p>}<Link href={`${path}#${r.kind==='renewal'?'renewals':r.kind.startsWith('review_')?`request-${r.source_id}`:`task-${r.source_id}`}`}>{t('Open related work','Abrir tarea relacionada')}</Link></section>)}{Number(rows[0].total_count)>rows.length&&<p>{t('The earliest 100 reminders are shown. Resolve those items and refresh to see later ones.','Se muestran los primeros 100 recordatorios. Resuélvelos y actualiza para ver los siguientes.')}</p>}</>}</>}
  </div></PlatformShell>;
}
