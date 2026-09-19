import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import {PlatformShell,PageHeading} from '@/components/platform-shell';
import {NdaPdfWorkspace} from '@/components/nda-pdf-workspace';
export const dynamic='force-dynamic';
export default async function Prepare({params,searchParams}:{params:Promise<{locale:string;id:string}>;searchParams:Promise<{saved?:string}>}) {
 const {locale,id}=await params;if(!isLocale(locale))notFound();
 const db=await createSupabaseServerClient(),{data:{user}}=await db.auth.getUser();if(!user)redirect(`/${locale}/sign-in`);
 const {data:template}=await db.from('listing_nda_templates').select('*').eq('listing_id',id).eq('broker_id',user.id).maybeSingle();
 const es=locale==='es';
 if(!template){const {data:listing}=await db.from('marketplace_listings').select('id').eq('id',id).eq('broker_id',user.id).maybeSingle();if(!listing)notFound();return <PlatformShell locale={locale} active="signing"><div className="dashboard-content"><PageHeading eyebrow="NDA" title={es?'Primero añade tu NDA':'Add your NDA first'} body={es?'Guarda un PDF revisado en tu anuncio y vuelve para colocar los campos de firma.':'Save a reviewed PDF on your listing, then return here to place signature fields.'}/><Link className="button button--primary" href={`/${locale}/dashboard/listings`}>{es?'Ir a mis anuncios':'Go to my listings'}</Link></div></PlatformShell>;}
 return <PlatformShell locale={locale} active="signing"><div className="dashboard-content"><PageHeading eyebrow="NDA" title={es?'Preparar campos de firma':'Prepare signature fields'} body={es?'Coloca los campos antes de enviar el NDA a nuevos compradores. Los acuerdos ya enviados no cambian.':'Place fields before sending the NDA to new buyers. Agreements already sent will not change.'}/><Link href={`/${locale}/dashboard/listings`}>{es?'Volver a anuncios':'Back to listings'}</Link>{(await searchParams).saved&&<p className="notice" role="status">{es?'Campos guardados para futuros acuerdos.':'Fields saved for future agreements.'}</p>}{template.storage_path?<NdaPdfWorkspace mode="prepare" locale={locale} source={`/api/nda-pdf/${id}?kind=template`} recordId={id} version={template.version} layout={template.signing_layout} title={template.document_name}/>:<p>{es?'Sube un PDF primero.':'Upload a PDF first.'}</p>}</div></PlatformShell>;
}
