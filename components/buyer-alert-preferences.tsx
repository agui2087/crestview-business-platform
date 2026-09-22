import {createSupabaseServerClient,isSupabaseConfigured} from '@/lib/supabase/server';
import {saveNotificationPreferences} from '@/app/[locale]/dashboard/settings/actions';
import {PendingAction} from '@/components/deal-document-upload';
export async function BuyerAlertPreferences({locale}:{locale:string}) {
 const es=locale==='es';
 if(!isSupabaseConfigured())return <section className="settings-panel"><h2>{es?'Notificaciones':'Notifications'}</h2><p>{es?'Inicia sesión para guardar preferencias en tu cuenta.':'Sign in to save account notification preferences.'}</p></section>;
 const db=await createSupabaseServerClient();const {data:{user}}=await db.auth.getUser();if(!user)return null;
 const {data,error}=await db.from('buyer_notification_preferences').select('messages,documents,deal_status').eq('user_id',user.id).maybeSingle();
 if(error)return <section className="settings-panel"><p role="alert">{es?'No se pudieron cargar las preferencias. Actualiza la página.':'Notification preferences could not be loaded. Refresh the page.'}</p></section>;
 const options=[['messages','New messages','Mensajes nuevos'],['documents','Document updates and requests','Actualizaciones y solicitudes de documentos'],['deal_status','Deal stage updates','Cambios de etapa del trato']] as const;
 return <form action={saveNotificationPreferences} className="settings-panel alert-preferences"><input type="hidden" name="locale" value={locale}/>
 <h2>{es?'Notificaciones dentro de Crestview':'In-app notification preferences'}</h2>
 <p>{es?'Se guardan en tu cuenta y se aplican a avisos futuros en todos tus dispositivos. No eliminan conversaciones ni cambian permisos.':'Saved to your account and applied to future notices across devices. They do not delete conversations or change access permissions.'}</p>
 <div className="alert-option-grid">{options.map(([key,en,spanish])=><label key={key}><input type="checkbox" name={key} defaultChecked={data?.[key]??true}/><span><strong>{es?spanish:en}</strong></span></label>)}</div>
 <p>{es?'Los avisos esenciales de firma, seguridad y decisiones de acceso siguen activos. Esto no activa correo electrónico, alertas automáticas de nuevas coincidencias, cambios de precio ni recordatorios de tareas.':'Essential signing, security and access-decision notices remain enabled. This does not enable email, automatic new-match alerts, price-change alerts or task reminders.'}</p>
 <PendingAction>{es?'Guardar notificaciones':'Save notification preferences'}</PendingAction></form>;
}
