import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {signingState,type SigningControls} from '@/lib/signing-workflow';
import styles from './signing.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Signing center',robots:{index:false,follow:false}};
export default async function SigningCenter({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{state?:string;q?:string}>}) {
 const {locale}=await params;if(!isLocale(locale))notFound();const t=(en:string,es:string)=>locale==='es'?es:en;
 const query=await searchParams;const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {data:ndas,error}=await supabase.from('deal_ndas').select('id,inquiry_id,document_name,template_version,status,buyer_id,sent_at,signed_at,signer_name').or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).order('created_at',{ascending:false}).limit(100);
 if(error)throw Error('Signing center could not load. Please try again.');
 const {data:controls,error:controlsError}=ndas?.length?await supabase.from('deal_nda_controls').select('*').in('nda_id',ndas.map(n=>n.id)):{data:[],error:null};
 if(controlsError)throw Error('Signing status could not be verified. Please try again.');
 const states=new Map((controls??[]).map(c=>[c.nda_id,c as SigningControls]));
 const rows=(ndas??[]).map(n=>({...n,state:signingState(n.status,states.get(n.id)??null),controls:states.get(n.id)}));
 const visible=rows.filter(n=>(!query.state||query.state==='all'||n.state===query.state||(query.state==='sent'&&n.state==='viewed'))&&(!query.q||n.document_name.toLowerCase().includes(query.q.toLowerCase())));
 const labels:Record<string,string>={sent:t('Awaiting signature','Pendiente de firma'),viewed:t('Awaiting signature','Pendiente de firma'),signed:t('Completed','Completado'),expired:t('Expired','Vencido'),withdrawn:t('Withdrawn','Retirado'),draft:t('Draft','Borrador'),declined:t('Declined','Rechazado'),superseded:t('Superseded','Sustituido')};
 return <PlatformShell locale={locale} active="signing"><div className="dashboard-content">
  <PageHeading eyebrow={t('Agreements','Acuerdos')} title={t('Signing center','Centro de firmas')} body={t('Review signature requests, deadlines, and completed records in one place.','Revisa solicitudes, plazos y registros completados en un solo lugar.')}/>
  <p>{t('Showing your latest 100 agreements. Reminders are in-app, not email. Each agreement currently has one buyer signer.','Se muestran tus 100 acuerdos más recientes. Los recordatorios son internos, no por correo. Cada acuerdo admite actualmente un firmante comprador.')}</p>
  <form method="get" className={`panel ${styles.filters}`}><label>{t('Search agreement name','Buscar nombre del acuerdo')}<input name="q" maxLength={160} defaultValue={query.q??''}/></label><label>{t('Status','Estado')}<select name="state" defaultValue={query.state??'all'}><option value="all">{t('All','Todos')}</option>{['sent','signed','expired','withdrawn','draft','declined','superseded'].map(s=><option value={s} key={s}>{labels[s]}</option>)}</select></label><button className="button button--primary" type="submit">{t('Filter','Filtrar')}</button></form>
  <div className={styles.records}>{visible.map(n=><article className={`panel ${styles.record}`} key={n.id}><span className={styles.status}>{labels[n.state]??n.state}</span><h2>{n.document_name}</h2><p>{t('Version','Versión')} {n.template_version} · {n.buyer_id===user.id?t('You are the signer','Tú eres el firmante'):t('Your buyer is the signer','Tu comprador es el firmante')}</p>{n.controls?.expires_at&&<p>{t('Deadline (UTC)','Plazo (UTC)')}: {new Date(n.controls.expires_at).toLocaleString(locale,{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</p>}{n.signed_at&&<p>{t('Signed (UTC)','Firmado (UTC)')}: {new Date(n.signed_at).toLocaleString(locale,{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</p>}<div className={styles.actions}><Link className="button button--light" href={`/${locale}/dashboard/deals/${n.inquiry_id}#deal-conversation`}>{t('Open agreement','Abrir acuerdo')}</Link>{n.state==='signed'&&<Link className="button button--light" href={`/${locale}/dashboard/deals/${n.inquiry_id}/agreement`}>{t('Signing record','Registro de firma')}</Link>}</div></article>)}</div>
  {!visible.length&&<p className="panel">{t('No agreements match this view. Agreements appear here when sent from a deal workspace or your listing’s reusable NDA.','No hay acuerdos que coincidan. Los acuerdos aparecen al enviarse desde un trato o el NDA reutilizable de tu anuncio.')}</p>}
  <Link href={`/${locale}/dashboard/listings`}>{t('Manage reusable listing NDAs','Administrar NDA reutilizables de anuncios')}</Link>
 </div></PlatformShell>;
}
