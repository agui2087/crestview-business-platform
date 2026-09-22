import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {PendingAction} from '@/components/deal-document-upload';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {sellerPreparationSteps} from '@/lib/seller-preparation';
import {saveListingFinancialContext,saveSellerPreparation} from './actions';
import {cashFlowLabels,figureTypeLabels} from '@/lib/listing-financial-context';
import styles from '../../../preparation/preparation.module.css';
export const dynamic='force-dynamic';
export default async function SellerPreparation({params,searchParams}:{params:Promise<{locale:string;id:string}>;searchParams:Promise<{saved?:string;error?:string}>}){
 const {locale,id}=await params;if(!isLocale(locale))notFound();const es=locale==='es';const t=(en:string,spanish:string)=>es?spanish:en;
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {data:listing,error:listingError}=await db.from('marketplace_listings').select('id,title,financial_period_start,financial_period_end,cash_flow_basis,financial_figure_type,financial_context_note').eq('id',id).eq('broker_id',user.id).maybeSingle();
 if(listingError)throw Error('Listing unavailable');if(!listing)notFound();
 const {data,error}=await db.from('seller_preparation').select('completed_steps').eq('listing_id',id).maybeSingle();if(error)throw Error('Preparation unavailable');
 const done=new Set<string>(data?.completed_steps??[]);const query=await searchParams;
 return <PlatformShell locale={locale} active="listings"><div className="dashboard-content"><PageHeading eyebrow={listing.title} title={t('Prepare the seller’s information','Prepara la información del vendedor')} body={t('A private working checklist for the listing owner. It does not certify the business, publish information or grant document access.','Una lista de trabajo privada del propietario del anuncio. No certifica el negocio, publica información ni concede acceso a documentos.')}/>
 {query.saved&&<p role="status">{t('Seller preparation saved.','Preparación del vendedor guardada.')}</p>}{query.error&&<p role="alert">{t('Could not save your checklist. Please try again.','No se pudo guardar la lista. Inténtalo de nuevo.')}</p>}
 <section className="panel"><h2>{t('Preparation progress','Progreso de preparación')}</h2><progress className={styles.progress} value={done.size} max={sellerPreparationSteps.length} aria-label={t('Self-reported seller preparation','Preparación del vendedor declarada')}/><p>{done.size} / {sellerPreparationSteps.length} {t('steps marked complete. This is not a verification badge.','pasos marcados. No es una insignia de verificación.')}</p></section>
 <form action={saveSellerPreparation} className={`settings-panel ${styles.form}`}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="listing_id" value={id}/>
 {sellerPreparationSteps.map(step=><section key={step.id}><label><input type="checkbox" name="completed_steps" value={step.id} defaultChecked={done.has(step.id)}/><strong>{es?step.es:step.en}</strong></label><p>{es?step.detailEs:step.detail}</p></section>)}
 <PendingAction>{t('Save seller preparation','Guardar preparación del vendedor')}</PendingAction></form>
 <form action={saveListingFinancialContext} className="settings-panel"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="listing_id" value={id}/>
 <h2>{t('Public financial context','Contexto financiero público')}</h2><p>{t('These fields appear with the published listing. Do not include confidential names, account numbers or documents. Leave unknown facts unspecified; this is not independent verification.','Estos campos aparecen en el anuncio publicado. No incluyas nombres confidenciales, números de cuenta ni documentos. Deja sin especificar lo desconocido; no es verificación independiente.')}</p>
 <div className="preference-grid"><label>{t('Period start','Inicio del período')}<input type="date" name="financial_period_start" defaultValue={listing.financial_period_start??''}/></label><label>{t('Period end','Fin del período')}<input type="date" name="financial_period_end" defaultValue={listing.financial_period_end??''}/></label>
 <label>{t('Earnings or cash-flow basis','Base del beneficio o flujo de caja')}<select name="cash_flow_basis" defaultValue={listing.cash_flow_basis}>{Object.entries(cashFlowLabels).map(([value,labels])=><option key={value} value={value}>{labels[es?1:0]}</option>)}</select></label>
 <label>{t('Actual or projected','Real o proyectado')}<select name="financial_figure_type" defaultValue={listing.financial_figure_type}>{Object.entries(figureTypeLabels).map(([value,labels])=><option key={value} value={value}>{labels[es?1:0]}</option>)}</select></label>
 <label className="span-two">{t('Public explanation of figures','Explicación pública de las cifras')}<textarea name="financial_context_note" maxLength={1000} defaultValue={listing.financial_context_note}/></label></div>
 <PendingAction>{t('Save public financial context','Guardar contexto financiero público')}</PendingAction></form>
 <p>{t('Uncheck a step whenever it needs more work. Keep sensitive information in your private notes or permission-controlled document room, not public listing fields.','Desmarca un paso si necesita más trabajo. Guarda información sensible en notas privadas o documentos con acceso controlado, no en campos públicos.')}</p><Link href={`/${locale}/dashboard/listings`}>{t('Back to your listings','Volver a tus anuncios')}</Link></div></PlatformShell>;
}
