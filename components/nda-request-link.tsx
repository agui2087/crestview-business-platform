'use client';
import {useState} from 'react';
export function NdaRequestLink({path,locale}:{path:string;locale:string}) {
 const [message,setMessage]=useState(''),[fallback,setFallback]=useState(''),es=locale==='es';
 async function copy(){const url=new URL(path,window.location.origin).href;try{await navigator.clipboard.writeText(url);setMessage(es?'Enlace copiado.':'Request link copied.');}catch{setFallback(url);setMessage(es?'Copia el enlace de abajo.':'Copy the link below.');}}
 return <section className="panel"><h2>{es?'Compartir solicitud':'Share signing request'}</h2><p>{es?'Envía este enlace a la otra parte con tu correo habitual. No envía un correo automáticamente ni concede acceso a otra persona. El destinatario debe iniciar sesión con su cuenta asignada.':'Send this link to the other party using your usual email. It does not send an email automatically or grant anyone new access. The recipient must sign in with their assigned account.'}</p><button type="button" className="button button--light" onClick={()=>void copy()}>{es?'Copiar enlace de firma':'Copy signing request link'}</button>{fallback&&<label>{es?'Enlace de solicitud':'Request link'}<input readOnly value={fallback} onFocus={e=>e.target.select()} style={{width:'100%'}}/></label>}<p role="status">{message}</p></section>;
}
