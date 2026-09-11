import Link from 'next/link';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export async function WorkforceAccessNotice({owner,locale}:{owner:string;locale:string}) {
 const db=await createSupabaseServerClient();
 const {data,error}=await db.rpc('workforce_billing_status',{p_owner:owner});
 const es=locale==='es';
 if(error)return <p role="alert">{es?'No se pudo comprobar la suscripción. Actualiza antes de guardar cambios.':'Subscription access could not be checked. Refresh before saving changes.'}</p>;
 if(data?.[0]?.active)return null;
 return <aside className="workforce-alerts" role="status"><strong>{es?'Espacio de solo lectura':'Read-only workspace'}</strong><p>{es?'Los registros y descargas siguen disponibles según tus permisos. El propietario debe renovar Workforce para guardar cambios. Aún puedes revocar acceso y archivos compartidos.':'Records and downloads remain available under your existing permissions. The business owner must renew Workforce to save changes. Access and file-share revocation remain available.'}</p><Link href={`/${locale}/pricing#workforce-pricing`}>{es?'Ver planes':'View plans'}</Link></aside>;
}
