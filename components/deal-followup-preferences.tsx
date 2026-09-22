import {createSupabaseServerClient} from '@/lib/supabase/server';
import {saveFollowupPause} from '@/app/[locale]/dashboard/deals/followup-actions';
import {PendingAction} from '@/components/deal-document-upload';
export async function DealFollowupPreferences({id,locale,isBuyer}:{id:string;locale:string;isBuyer:boolean}){
 const db=await createSupabaseServerClient();const es=locale==='es';
 const {data,error}=await db.from('buyer_followup_preferences').select('paused,updated_at').eq('inquiry_id',id).maybeSingle();
 if(error)return <p role="alert">{es?'No se pudo comprobar la preferencia de seguimiento.':'The follow-up preference could not be checked.'}</p>;
 if(!isBuyer)return data?.paused?<section className="panel"><h2>{es?'El comprador solicita una pausa':'Buyer requests a pause'}</h2><p>{es?'Evita el seguimiento rutinario hasta que el comprador reanude. Sus avisos de mensajes están silenciados para este trato; las conversaciones se conservan. No cambia acuerdos, plazos ni permisos.':'Avoid routine follow-up until the buyer resumes. Their message notices are muted for this inquiry; conversations are preserved. Agreements, deadlines and permissions are unchanged.'}</p></section>:null;
 return <form action={saveFollowupPause} className="panel"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="inquiry_id" value={id}/><h2>{es?'Tu ritmo de seguimiento':'Your follow-up pace'}</h2>
 <label><input type="checkbox" name="paused" defaultChecked={data?.paused??false}/>{es?'Pedir una pausa en el seguimiento rutinario':'Request a pause in routine follow-up'}</label>
 <p>{es?'El corredor verá tu solicitud. Se silencian nuevos avisos de mensajes de este trato, pero puedes leer y escribir en la conversación. Los avisos esenciales continúan. No se retira tu consulta ni se cambian acuerdos, plazos o acceso. Desmarca para reanudar.':'The broker will see your request. New message notices for this inquiry are muted, but you can still read and write in the conversation. Essential notices continue. This does not withdraw your inquiry or change agreements, deadlines or access. Uncheck to resume.'}</p>
 <PendingAction>{es?'Guardar preferencia de seguimiento':'Save follow-up preference'}</PendingAction></form>;
}
