import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {NdaPdfWorkspace} from '@/components/nda-pdf-workspace';
import {signingState} from '@/lib/signing-workflow';
export const dynamic='force-dynamic';
export default async function Sign({params}:{params:Promise<{locale:string;id:string}>}) {
 const {locale,id}=await params;if(!isLocale(locale))notFound();
 const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {data:nda}=await db.from('deal_ndas').select('*').eq('inquiry_id',id).eq('buyer_id',user.id).maybeSingle();if(!nda)notFound();
 if(nda.status==='signed')redirect(`/${locale}/dashboard/deals/${id}/agreement`);
 const {data:controls,error}=await db.from('deal_nda_controls').select('*').eq('nda_id',nda.id).maybeSingle();if(error)throw Error('Signing status unavailable');
 const ready=['sent','viewed'].includes(signingState(nda.status,controls)),es=locale==='es';
 return <PlatformShell locale={locale} active="signing"><div className="dashboard-content"><PageHeading eyebrow="NDA" title={es?'Revisar y firmar':'Review and sign'} body={es?'Lee el documento completo y completa cada campo marcado antes de confirmar.':'Read the complete agreement and complete each marked field before confirming.'}/><Link href={`/${locale}/dashboard/deals/${id}`}>{es?'Volver al trato':'Back to deal'}</Link>{ready&&nda.signing_layout?<NdaPdfWorkspace mode="sign" locale={locale} source={`/api/nda-pdf/${nda.id}`} recordId={nda.id} version={nda.template_version} layout={nda.signing_layout} title={nda.document_name}/>:<p role="status">{es?'Esta solicitud no está disponible para firma visual. Revisa su estado en el trato.':'This request is not available for visual signing. Check its status in the deal workspace.'}</p>}</div></PlatformShell>;
}
