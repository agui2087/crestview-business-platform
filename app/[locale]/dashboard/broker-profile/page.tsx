import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {PendingAction} from '@/components/deal-document-upload';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {brokerProfileFields,brokerProfileSelect} from '@/lib/broker-profile';
import {saveBrokerProfile} from './actions';
export const dynamic='force-dynamic';
export default async function BrokerProfile({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{saved?:string;error?:string}>}){
 const {locale}=await params;if(!isLocale(locale))notFound();const es=locale==='es';const t=(en:string,spanish:string)=>es?spanish:en;
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {data:account}=await db.from('profiles').select('account_roles').eq('user_id',user.id).maybeSingle();if(!account?.account_roles?.includes('broker'))redirect(`/${locale}/dashboard/settings`);
 const {data:profile,error}=await db.from('broker_profiles').select(brokerProfileSelect).eq('user_id',user.id).maybeSingle();if(error)throw Error('Broker profile unavailable');
 const query=await searchParams;
 const labels={display_name:t('Professional name','Nombre profesional'),brokerage:t('Brokerage or business','Correduría o empresa'),biography:t('About you','Sobre ti'),service_areas:t('Areas served','Áreas de servicio'),specialties:t('Industries and specialties','Sectores y especialidades'),languages:t('Languages','Idiomas'),buyer_approach:t('How you work with buyers','Cómo trabajas con compradores')};
 const limits={display_name:100,brokerage:160,biography:2000,service_areas:500,specialties:500,languages:200,buyer_approach:1000};
 return <PlatformShell locale={locale} active="broker-profile"><div className="dashboard-content"><PageHeading eyebrow={t('Professional profile','Perfil profesional')} title={t('Your broker profile','Tu perfil de corredor')} body={t('Help buyers understand your experience and process. Drafts stay private until you choose to publish.','Ayuda a los compradores a conocer tu experiencia y proceso. Los borradores son privados hasta que decidas publicarlos.')}/>
 {query.saved&&<p role="status">{t('Profile saved.','Perfil guardado.')}</p>}{query.error&&<p role="alert">{t('Could not save. Check the field limits and include a biography of at least 40 characters to publish. Try again if the problem persists.','No se pudo guardar. Comprueba los límites e incluye una biografía de al menos 40 caracteres para publicar. Inténtalo de nuevo si el problema persiste.')}</p>}
 <form action={saveBrokerProfile} className="settings-panel"><input type="hidden" name="locale" value={locale}/><p>{t('Only the information in this form becomes public. Your account email, phone and private records are not copied. Do not include confidential client information. Professional claims are self-reported, not verified by Crestview.','Solo la información de este formulario se hace pública. No se copian tu correo, teléfono ni registros privados. No incluyas información confidencial de clientes. Crestview no verifica las afirmaciones profesionales.')}</p>
 <div className="preference-grid">{brokerProfileFields.map(k=><label key={k}>{labels[k]}{['biography','buyer_approach'].includes(k)?<textarea name={k} maxLength={limits[k]} rows={5} defaultValue={profile?.[k]??''}/>:<input name={k} maxLength={limits[k]} required={k==='display_name'} minLength={k==='display_name'?2:undefined} defaultValue={profile?.[k]??''}/>}</label>)}</div>
 <label><input type="checkbox" name="welcomes_preparing_buyers" defaultChecked={profile?.welcomes_preparing_buyers??true}/>{t('I welcome introductory questions from buyers still preparing or exploring financing.','Acepto preguntas iniciales de compradores que se están preparando o explorando financiación.')}</label>
 <label><input type="checkbox" name="published" defaultChecked={profile?.published??false}/>{t('Publish this profile on the public broker directory. Uncheck and save to remove public access.','Publicar este perfil en el directorio público. Desmarca y guarda para quitar el acceso público.')}</label>
 <PendingAction>{t('Save broker profile','Guardar perfil de corredor')}</PendingAction>
 {profile?.published&&<Link href={`/${locale}/brokers/${user.id}`}>{t('View public profile','Ver perfil público')}</Link>}</form></div></PlatformShell>;
}
