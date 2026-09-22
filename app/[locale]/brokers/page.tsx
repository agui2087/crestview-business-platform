import Link from 'next/link';
import {notFound} from 'next/navigation';
import {MarketingHeader,MarketingFooter} from '@/components/marketing-shell';
import {createSupabaseServerClient,isSupabaseConfigured} from '@/lib/supabase/server';
import {isLocale} from '@/lib/i18n';
import styles from './brokers.module.css';
export const dynamic='force-dynamic';
export default async function Brokers({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string}>}){
 const {locale}=await params;if(!isLocale(locale))notFound();const es=locale==='es';const {page:raw}=await searchParams;
 const page=/^[1-9]\d{0,3}$/.test(raw??'')?Number(raw):1;
 let profiles:{user_id:string;display_name:string;brokerage:string;service_areas:string;welcomes_preparing_buyers:boolean}[]=[];
 if(isSupabaseConfigured()){
  const db=await createSupabaseServerClient();const {data,error}=await db.from('broker_profiles').select('user_id,display_name,brokerage,service_areas,welcomes_preparing_buyers').eq('published',true).order('display_name').order('user_id').range((page-1)*24,page*24);
  if(error)throw Error('Broker directory unavailable');profiles=data??[];
 }
 return <><MarketingHeader locale={locale}/><main className={styles.page}><div className="shell"><h1>{es?'Conoce a los corredores':'Meet the brokers'}</h1><p>{es?'Conoce sus especialidades y cómo trabajan con compradores. La información es proporcionada por cada profesional, no es una verificación de licencia ni una recomendación de Crestview.':'Explore their specialties and approach to buyers. Information is provided by each professional, not a license verification or endorsement by Crestview.'}</p>
 {!profiles.length&&<p>{es?'Todavía no hay perfiles publicados en esta página. Puedes seguir explorando negocios.':'No published profiles on this page yet. You can still browse businesses.'}</p>}
 <div className="journey-grid">{profiles.slice(0,24).map(p=><article key={p.user_id}><h2><Link href={`/${locale}/brokers/${p.user_id}`}>{p.display_name}</Link></h2><p>{p.brokerage}</p><p>{p.service_areas}</p>{p.welcomes_preparing_buyers&&<p>{es?'Acepta compradores que se están preparando':'Welcomes buyers who are still preparing'}</p>}</article>)}</div>
 <nav aria-label={es?'Páginas del directorio':'Directory pages'}>{page>1&&<Link href={`/${locale}/brokers?page=${page-1}`}>{es?'Anterior':'Previous'}</Link>}{profiles.length>24&&<Link href={`/${locale}/brokers?page=${page+1}`}>{es?'Siguiente':'Next'}</Link>}</nav>
 <Link href={`/${locale}/listings`}>{es?'Explorar negocios':'Browse businesses'}</Link></div></main><MarketingFooter locale={locale}/></>;
}
