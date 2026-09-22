import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {MarketingHeader,MarketingFooter} from '@/components/marketing-shell';
import {createSupabaseServerClient,isSupabaseConfigured} from '@/lib/supabase/server';
import {brokerProfileSelect} from '@/lib/broker-profile';
import {isLocale} from '@/lib/i18n';
import styles from '../brokers.module.css';
export const dynamic='force-dynamic';
export default async function Broker({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale,id}=await params;if(!isLocale(locale)||!z.string().uuid().safeParse(id).success||!isSupabaseConfigured())notFound();const es=locale==='es';
 const db=await createSupabaseServerClient();const {data:p,error}=await db.from('broker_profiles').select(brokerProfileSelect).eq('user_id',id).eq('published',true).maybeSingle();if(error)throw Error('Broker profile unavailable');if(!p)notFound();
 const {data:listings,error:listingsError}=await db.from('marketplace_listings').select('id,title,city,state_code').eq('broker_id',id).eq('status','published').order('updated_at',{ascending:false}).limit(12);if(listingsError)throw Error('Broker listings unavailable');
 return <><MarketingHeader locale={locale}/><main className={styles.page}><div className="shell"><Link href={`/${locale}/brokers`}>{es?'Todos los corredores':'All brokers'}</Link><h1>{p.display_name}</h1><p>{p.brokerage}</p><p>{es?'Información proporcionada por el profesional. Crestview no ha verificado sus credenciales.':'Information supplied by the professional. Crestview has not verified their credentials.'}</p>
 <section><h2>{es?'Sobre mí':'About me'}</h2><p style={{whiteSpace:'pre-wrap'}}>{p.biography}</p></section>
 <dl>{[[es?'Áreas de servicio':'Areas served',p.service_areas],[es?'Especialidades':'Specialties',p.specialties],[es?'Idiomas':'Languages',p.languages]].map(([label,value])=>value&&<div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 {p.buyer_approach&&<section><h2>{es?'Cómo trabajo con compradores':'How I work with buyers'}</h2><p style={{whiteSpace:'pre-wrap'}}>{p.buyer_approach}</p></section>}
 {p.welcomes_preparing_buyers&&<p>{es?'Acepto preguntas iniciales de compradores que se están preparando o explorando financiación. El acceso a información confidencial sigue sujeto a los requisitos de cada negocio.':'I welcome introductory questions from buyers still preparing or exploring financing. Confidential access remains subject to each business’s requirements.'}</p>}
 <section><h2>{es?'Anuncios actuales':'Current listings'}</h2>{listings?.length?<ul>{listings.map(l=><li key={l.id}><Link href={`/${locale}/dashboard/marketplace#listing-${l.id}`}>{l.title}</Link><p>{l.city}, {l.state_code}</p></li>)}</ul>:<p>{es?'No hay anuncios públicos disponibles en este momento.':'No public listings are available at this time.'}</p>}</section>
 <p>{es?'Actualizado':'Updated'}: {new Date(p.updated_at).toISOString().slice(0,10)}</p><Link href={`/${locale}/listings`}>{es?'Explorar negocios':'Browse businesses'}</Link></div></main><MarketingFooter locale={locale}/></>;
}
