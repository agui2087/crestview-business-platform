import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {PendingAction} from '@/components/deal-document-upload';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {preparationSteps} from '@/lib/buyer-preparation';
import {savePreparation} from './actions';
import styles from './preparation.module.css';
export const dynamic='force-dynamic';
export default async function Preparation({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{saved?:string;error?:string}>}){
 const {locale}=await params;if(!isLocale(locale))notFound();const es=locale==='es';const t=(en:string,spanish:string)=>es?spanish:en;
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {data,error}=await db.from('buyer_preparation').select('path,completed_steps').eq('user_id',user.id).maybeSingle();if(error)throw Error('Preparation unavailable');
 const done=new Set<string>(data?.completed_steps??[]);const next=preparationSteps.find(s=>!done.has(s.id));const query=await searchParams;
 return <PlatformShell locale={locale} active="preparation"><div className="dashboard-content"><PageHeading eyebrow={t('Your starting point','Tu punto de partida')} title={t('Prepare at your own pace','Prepárate a tu ritmo')} body={t('You are welcome even if you are still building savings or exploring financing. This private plan helps you learn; it does not rank or reject you.','Eres bienvenido aunque estés ahorrando o explorando financiación. Este plan privado te ayuda a aprender; no te clasifica ni te rechaza.')}/>
 {query.saved&&<p role="status">{t('Preparation saved.','Preparación guardada.')}</p>}{query.error&&<p role="alert">{t('Could not save your plan. Please try again.','No se pudo guardar tu plan. Inténtalo de nuevo.')}</p>}
 <section className="panel"><h2>{t('Your saved preparation progress','Tu progreso guardado')}</h2><progress className={styles.progress} value={done.size} max={preparationSteps.length} aria-label={t('Self-reported preparation steps','Pasos de preparación declarados')}/><p>{done.size} / {preparationSteps.length} {t('learning steps marked complete. This is not a qualification score.','pasos educativos marcados. No es una puntuación de calificación.')}</p>{next&&<p>{t('Suggested next step:','Siguiente paso sugerido:')} {es?next.es:next.en}</p>}</section>
 <form action={savePreparation} className={`settings-panel ${styles.form}`}><input type="hidden" name="locale" value={locale}/><fieldset><legend>{t('Where are you today?','¿En qué etapa estás?')}</legend><label><input type="radio" name="path" value="preparing" defaultChecked={!data||data.path==='preparing'}/>{t('Preparing to buy','Preparándome para comprar')}</label><label><input type="radio" name="path" value="searching" defaultChecked={data?.path==='searching'}/>{t('Actively searching','Buscando activamente')}</label><p>{t('Both paths can browse listings and use the learning tools. Change this whenever you want. Your choice and checklist are private and do not grant document access.','Ambas opciones permiten explorar anuncios y aprender. Puedes cambiar cuando quieras. Tu elección y lista son privadas y no conceden acceso a documentos.')}</p></fieldset>
 {preparationSteps.map(s=><section key={s.id}><label><input type="checkbox" name="completed_steps" value={s.id} defaultChecked={done.has(s.id)}/><strong>{es?s.es:s.en}</strong></label><p>{es?s.detailEs:s.detail}</p><Link href={`/${locale}${s.href}`}>{t('Explore this step','Explorar este paso')}: {es?s.es:s.en}</Link></section>)}
 <PendingAction>{t('Save preparation','Guardar preparación')}</PendingAction></form>
 <p>{t('You can reopen any step by unchecking it. Your progress is self-reported, not independently reviewed. No financing, access approval or successful purchase is guaranteed.','Puedes reabrir pasos desmarcándolos. El progreso es declarado por ti, no revisado independientemente. No se garantiza financiación, acceso ni compra.')}</p><Link href={`/${locale}/dashboard/marketplace`}>{t('Browse broker-posted businesses','Explorar negocios publicados por corredores')}</Link></div></PlatformShell>;
}
