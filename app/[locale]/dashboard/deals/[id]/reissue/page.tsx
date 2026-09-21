import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {PendingAction} from '@/components/deal-document-upload';
import {reissueAgreement} from '@/app/[locale]/dashboard/signing/actions';
export const dynamic='force-dynamic';
export default async function Reissue({params,searchParams}:{params:Promise<{locale:string;id:string}>;searchParams:Promise<{error?:string;reissued?:string}>}){
 const {locale,id}=await params;if(!isLocale(locale))notFound();const t=(en:string,es:string)=>locale==='es'?es:en;
 const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {data:inquiry}=await db.from('deal_inquiries').select('listing_id,broker_id,status,financial_access_status').eq('id',id).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();if(!inquiry)notFound();
 const {data:nda,error:ndaError}=await db.from('deal_ndas').select('id,document_name,status,template_version').eq('inquiry_id',id).maybeSingle();if(ndaError)throw Error('Agreement unavailable');if(!nda)notFound();
 const broker=inquiry.broker_id===user.id;
 const [{data:history,error:historyError},{data:signatures,error:signatureError}]=await Promise.all([
  db.from('deal_nda_revisions').select('id,revision,archived_at,reason').eq('nda_id',nda.id).order('revision',{ascending:false}).limit(50),
  db.from('deal_nda_signatures').select('role').eq('nda_id',nda.id),
 ]);if(historyError||signatureError)throw Error('Revision history unavailable');
 const {data:template,error:templateError}=broker?await db.from('listing_nda_templates').select('document_name,version,storage_path,broker_attested,security_status').eq('listing_id',inquiry.listing_id).eq('broker_id',user.id).maybeSingle():{data:null,error:null};if(templateError)throw Error('Template unavailable');
 const eligible=broker&&['submitted','nda_sent'].includes(inquiry.status)&&inquiry.financial_access_status!=='approved'&&['sent','viewed','declined'].includes(nda.status)&&!signatures?.length;
 const ready=eligible&&template?.broker_attested&&['basic_validated','malware_scanned'].includes(template.security_status);
 const query=await searchParams;
 return <PlatformShell locale={locale} active="signing"><div className="dashboard-content"><PageHeading eyebrow="NDA" title={t('Agreement revisions','Revisiones del acuerdo')} body={t('Prior unsigned versions are preserved. Any recorded signature blocks replacement. Reissue does not cancel a signed contract.','Se conservan las versiones anteriores sin firmar. Cualquier firma registrada impide el reemplazo. La reemisión no cancela contratos firmados.')}/>
  <Link href={`/${locale}/dashboard/deals/${id}`}>{t('Back to deal','Volver al trato')}</Link>
  {query.reissued&&<p role="status" className="notice">{t('Replacement sent in-app. The buyer must review the new version. Previous signing screens are no longer valid.','Reemplazo enviado en la aplicación. El comprador debe revisar la nueva versión. Las pantallas anteriores ya no son válidas.')}</p>}
  {query.error&&<p role="alert" className="notice">{t('Could not confirm reissue. Refresh and check the current version before retrying. A signature, changed template or unavailable original can block replacement.','No se pudo confirmar. Actualiza y comprueba la versión antes de reintentar. Una firma, un cambio de plantilla o un original no disponible pueden impedirlo.')}</p>}
  <section className="panel"><h2>{t('Current request','Solicitud actual')}</h2><p>{nda.document_name} · {t('Version','Versión')} {nda.template_version}</p></section>
  {broker&&<section className="panel"><h2>{t('Correct and reissue','Corregir y volver a enviar')}</h2>{!ready?<p>{t('Replacement is available only before anyone signs or the deal progresses, using a reviewed listing NDA.','El reemplazo solo está disponible antes de cualquier firma o avance del trato, usando un NDA revisado del anuncio.')}</p>:<>
   <p>{t('Replacement template:','Plantilla de reemplazo:')} {template.document_name} · {t('Template version','Versión de plantilla')} {template.version}</p>
   <Link href={`/${locale}/dashboard/listings/${inquiry.listing_id}/prepare-nda`}>{t('Review or prepare replacement template','Revisar o preparar la plantilla')}</Link>
   {template.storage_path&&<p><a href={`/api/nda-pdf/${inquiry.listing_id}?kind=template`} target="_blank" rel="noreferrer">{t('Read replacement PDF','Leer PDF de reemplazo')}</a></p>}
   <form action={reissueAgreement}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="inquiry_id" value={id}/><input type="hidden" name="nda_id" value={nda.id}/><input type="hidden" name="nda_version" value={nda.template_version}/><input type="hidden" name="template_version" value={template.version}/>
    <label>{t('Explain the correction to the buyer','Explica la corrección al comprador')}<textarea name="reason" minLength={10} maxLength={1000} required/></label>
    <label><input type="checkbox" name="confirmed" required/>{t('I reviewed the replacement and understand that the buyer must review it again.','Revisé el reemplazo y entiendo que el comprador debe revisarlo de nuevo.')}</label>
    <PendingAction>{t('Preserve old version and reissue','Conservar versión anterior y reenviar')}</PendingAction>
   </form></>}</section>}
  <section className="panel"><h2>{t('Preserved unsigned versions','Versiones anteriores sin firmar')}</h2>{!history?.length?<p>{t('No earlier revisions.','No hay revisiones anteriores.')}</p>:<ol>{history.map(r=><li key={r.id}><h3>{t('Version','Versión')} {r.revision}</h3><p>{new Date(r.archived_at).toISOString()} (UTC)</p><p>{r.reason}</p><a href={`/api/deals/${id}/nda-history/${r.id}`}>{t('Download revision record','Descargar registro de revisión')}</a>{' · '}<a href={`/api/deals/${id}/nda-history/${r.id}?format=original`}>{t('Download prior original, if PDF','Descargar original anterior, si es PDF')}</a></li>)}</ol>}</section>
 </div></PlatformShell>;
}
