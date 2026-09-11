'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
const AnalyticsConsent=createContext(false);
export function PromotionAnalytics({locale,children}:{locale:string;children:ReactNode}){
  const [enabled,setEnabled]=useState(false);const es=locale==='es';
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function clear(){
    setEnabled(false);setBusy(true);
    try{const response=await fetch('/api/listing-promotion/engagement',{method:'DELETE'});
      setMessage(response.ok?(es?'Tu actividad de promociones se eliminó.':'Your promotion activity was cleared.'):(es?'No se pudo borrar. Inténtalo de nuevo.':'Could not clear activity. Please retry.'));
    }catch{setMessage(es?'No se pudo borrar. Inténtalo de nuevo.':'Could not clear activity. Please retry.');}finally{setBusy(false);}
  }
  return <AnalyticsConsent.Provider value={enabled}>
    <details style={{marginBlock:'1rem'}}><summary>{es?'Privacidad de las promociones':'Promotion privacy controls'}</summary>
      <p>{es?'Opcional: permite medir vistas e interacciones con promociones durante esta visita. Crestview vincula estos datos a tu cuenta para evitar duplicados. Los corredores solo ven totales, nunca tu identidad en estos informes. No afecta el acceso a anuncios.':'Optional: allow promotion views and interactions to be measured during this visit. Crestview links this activity to your account to avoid duplicate counts. Brokers see totals only, never your identity in these reports. This does not affect listing access.'}</p>
      <label><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/>{es?'Permitir estadísticas de promociones durante esta visita':'Allow promotion analytics during this visit'}</label>
      <p>{es?'La preferencia no se guarda. Desactívala para detener nuevas mediciones. Puedes borrar tu actividad anterior; los totales se actualizarán. Los informes abarcan los últimos 90 días.':'This preference is not saved. Switch it off to stop new measurements. You can clear your previous activity; report totals will change. Reports cover the last 90 days.'}</p>
      <button type="button" className="button button--light" disabled={busy} onClick={clear}>{es?'Borrar mi actividad de promociones':'Clear my promotion activity'}</button>
      <p role="status">{message}</p>
    </details>
    {children}
  </AnalyticsConsent.Provider>;
}
export function PromotionEngagement({listingId}:{listingId:string}){
  const marker=useRef<HTMLSpanElement>(null);
  const enabled=useContext(AnalyticsConsent);
  useEffect(()=>{
    if(!enabled)return;
    const card=marker.current?.closest('article');if(!card)return;
    const sent=new Set<string>();
    const record=(kind:string)=>{
      if(sent.has(kind))return;sent.add(kind);
      void fetch('/api/listing-promotion/engagement',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listing_id:listingId,kind}),keepalive:true}).catch(()=>{});
    };
    let timer:ReturnType<typeof setTimeout>|undefined;
    const observer=new IntersectionObserver(([entry])=>{
      if(timer)clearTimeout(timer);
      if(entry.isIntersecting)timer=setTimeout(()=>{if(document.visibilityState==='visible')record('view');},1000);
    },{threshold:0.5});observer.observe(card);
    const click=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('summary,button,a'))record('engagement');};
    card.addEventListener('click',click);
    return()=>{observer.disconnect();if(timer)clearTimeout(timer);card.removeEventListener('click',click);};
  },[listingId,enabled]);
  return <span ref={marker} aria-hidden="true"/>;
}
