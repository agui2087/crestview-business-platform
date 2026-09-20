import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {NdaPdfWorkspace} from '@/components/nda-pdf-workspace';
import {NdaRequestLink} from '@/components/nda-request-link';
import {signingState} from '@/lib/signing-workflow';
import {parseNdaLayout,signerRoles,canSignerProceed,type SignerRole} from '@/lib/nda-fields';
export const dynamic='force-dynamic';
export default async function Sign({params}:{params:Promise<{locale:string;id:string}>}) {
 const {locale,id}=await params;if(!isLocale(locale))notFound();
 const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in?return_to=${encodeURIComponent(`/${locale}/dashboard/deals/${id}/sign`)}`);
 const {data:nda}=await db.from('deal_ndas').select('*').eq('inquiry_id',id).or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();if(!nda)notFound();
 if(nda.status==='signed')redirect(`/${locale}/dashboard/deals/${id}/agreement`);
 const {data:controls,error}=await db.from('deal_nda_controls').select('*').eq('nda_id',nda.id).maybeSingle();if(error)throw Error('Signing status unavailable');
 const ready=['sent','viewed'].includes(signingState(nda.status,controls)),es=locale==='es';
 const {data:signatures,error:signatureError}=await db.from('deal_nda_signatures').select('role,legal_name,signed_at,field_values').eq('nda_id',nda.id);if(signatureError)throw Error('Signature progress unavailable');
 const layout=nda.signing_layout?parseNdaLayout(nda.signing_layout):null,role:SignerRole=user.id===nda.buyer_id?'buyer':'broker';
 const allowed=layout&&canSignerProceed(layout,role,(signatures??[]).map(s=>s.role as SignerRole));
 return <PlatformShell locale={locale} active="signing"><div className="dashboard-content"><PageHeading eyebrow="NDA" title={es?'Revisar y firmar':'Review and sign'} body={es?'Lee el documento completo y completa cada campo marcado antes de confirmar.':'Read the complete agreement and complete each marked field before confirming.'}/><Link href={`/${locale}/dashboard/deals/${id}`}>{es?'Volver al trato':'Back to deal'}</Link>{ready&&layout&&<NdaRequestLink path={`/${locale}/dashboard/deals/${id}/sign`} locale={locale}/ >}{layout&&<section className="panel"><h2>{es?'Progreso de firmas':'Signature progress'}</h2><p>{signatures?.length??0} / {signerRoles(layout).length} {es?'partes firmaron':'parties signed'}</p><ul>{signerRoles(layout).map(r=>{const s=signatures?.find(s=>s.role===r);return <li key={r}>{r==='buyer'?(es?'Comprador':'Buyer'):(es?'Corredor':'Broker')}: {s?`${s.legal_name} · ${s.signed_at}`:(es?'Pendiente':'Pending')}</li>;})}</ul><p>{es?'El acceso sujeto al NDA se habilita cuando firman todas las partes.':'NDA-gated access opens only after all required parties sign.'}</p></section>}{ready&&layout&&allowed?<NdaPdfWorkspace mode="sign" locale={locale} source={`/api/nda-pdf/${nda.id}`} recordId={nda.id} version={nda.template_version} layout={layout} title={nda.document_name} role={role} previous={Object.assign({},...(signatures??[]).map(s=>s.field_values))}/>:<p role="status">{signatures?.some(s=>s.role===role)?(es?'Tu firma está registrada. Esperando a la otra parte.':'Your signature is recorded. Waiting for the other party.'):(es?'Esta solicitud no está disponible para tu firma todavía. Revisa el orden y el estado.':'This request is not available for your signature yet. Check its order and status.')}</p>}</div></PlatformShell>;
}
