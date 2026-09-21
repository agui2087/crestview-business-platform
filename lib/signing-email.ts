import {z} from 'zod';

// Deliberately no document titles, attachments, financial data, or bearer tokens.
const messageSchema=z.object({
 id:z.string().uuid(),recipient:z.string().email().max(254),
 inquiryId:z.string().uuid(),locale:z.enum(['en','es']),
 kind:z.enum(['invitation','reminder','completed']),
}).strict();
export type SigningEmail=z.infer<typeof messageSchema>;
export type EmailResult={state:'sent';providerId:string}|{state:'retry'|'failed';code:string};

export function signingEmailContent(raw:SigningEmail,origin:string) {
 const m=messageSchema.parse(raw),url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use an HTTPS application origin');
 const es=m.locale==='es',completed=m.kind==='completed';
 const subject=completed?(es?'Crestview: acuerdo completado':'Crestview: agreement completed'):m.kind==='reminder'?(es?'Crestview: recordatorio de firma':'Crestview: signing reminder'):(es?'Crestview: solicitud de firma':'Crestview: signature request');
 const link=new URL(`/${m.locale}/dashboard/deals/${m.inquiryId}${completed?'/agreement':''}`,url).href;
 const text=[subject,'',es?'Accede a tu espacio seguro para revisar el acuerdo.':'Open your secure workspace to review the agreement.',link,'',es?'Debes iniciar sesión con la cuenta asignada. Este correo no concede acceso a documentos.':'Sign in with the assigned account. This email does not grant document access.',es?'Si no esperabas este mensaje, puedes ignorarlo.':'If you did not expect this message, you can ignore it.'].join('\n');
 return {subject,text};
}

export async function sendSigningEmail(raw:SigningEmail,config:{apiKey:string;from:string;origin:string},send:typeof fetch=fetch):Promise<EmailResult> {
 const m=messageSchema.parse(raw),content=signingEmailContent(m,config.origin);
 if(!config.apiKey||!z.string().email().safeParse(config.from).success)return {state:'failed',code:'configuration'};
 try {
  const response=await send('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10_000),headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`signing/${m.id}`},body:JSON.stringify({from:config.from,to:[m.recipient],...content})});
  // Never log provider response bodies: they can contain recipient data.
  if(!response.ok)return {state:response.status===429||response.status>=500?'retry':'failed',code:`provider_${response.status}`};
  const result=z.object({id:z.string().uuid()}).safeParse(await response.json());
  return result.success?{state:'sent',providerId:result.data.id}:{state:'retry',code:'invalid_response'};
 }catch{return {state:'retry',code:'connection'};}
}

// Retries must stop before the provider's 24-hour idempotency window expires.
// An ambiguous older request needs reconciliation, never a blind second send.
export function emailRetryAt(attempt:number,firstAttempt:number,now=Date.now()):number|null {
 if(!Number.isInteger(attempt)||attempt<1||attempt>=8||!Number.isFinite(firstAttempt)||firstAttempt>now)return null;
 const next=now+Math.min(60_000*2**(attempt-1),3_600_000);
 return next<firstAttempt+23*3_600_000?next:null;
}
