'use client';
import {useState} from 'react';
import {useFormStatus} from 'react-dom';
import {suggestedDocumentTitle, buyerCanReadDocument, type DocumentAccess} from '@/lib/document-sharing';

export function PendingAction({children, pendingText='Saving…',disabled=false}:{children:React.ReactNode;pendingText?:string;disabled?:boolean}) {
  const {pending}=useFormStatus();
  return <button className="button button--primary" type="submit" disabled={pending||disabled}>{pending?pendingText:children}</button>;
}
export function DealDocumentUpload({action,locale,inquiryId,ndaSigned,approved,requests,replacement}:{action:(data:FormData)=>Promise<void>;locale:string;inquiryId:string;ndaSigned:boolean;approved:boolean;requests:{id:string;item_name:string}[];replacement?:{id:string;version:number;access:string;title:string;category:string}}) {
  const es=locale==='es';
  const [title,setTitle]=useState(replacement?.title ?? '');
  const [access,setAccess]=useState<DocumentAccess>('broker_only');
  const [link,setLink]=useState(false);
  const [error,setError]=useState('');
  return <form action={action}>
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="inquiry_id" value={inquiryId}/>
    {replacement ? <><input type="hidden" name="replace_document_id" value={replacement.id}/><input type="hidden" name="replace_version" value={replacement.version}/><input type="hidden" name="replace_access" value={replacement.access}/><p>{es?'El original se conserva. La nueva versión mantendrá los permisos actuales y solo se publicará si supera las comprobaciones.':'The original is preserved. The new version keeps current sharing permissions and is released only after security checks pass.'}</p><label>{es?'Qué cambió':'What changed?'}<textarea name="replacement_note" required minLength={3} maxLength={500}/></label></> : <label>{es?'Origen del documento':'Document source'}<select value={link?'link':'file'} onChange={e=>{setLink(e.target.value==='link');setError('');}}><option value="file">{es?'Subir un archivo privado':'Upload a private file'}</option><option value="link">{es?'Enlace externo':'External link'}</option></select></label>}
    {link?<><label>{es?'Enlace HTTPS':'HTTPS link'}<input name="external_url" type="url" placeholder="https://" required/></label><p>{es?'Crestview no controla ni analiza el destino. Configura también sus permisos en el servicio externo.':'Crestview does not control or scan the destination. Set its permissions in the external service too; anyone with that link may retain access there.'}</p></>:<label>{es?'Elegir archivo':'Choose a file'}<input name="document_file" type="file" accept=".pdf,.csv,.xls,.xlsx,.doc,.docx" required onChange={e=>{const file=e.target.files?.[0];setError(file&&file.size>3_500_000?(es?'El archivo supera 3.5 MB.':'File exceeds 3.5 MB. Choose a smaller file.'): '');if(file&&!title)setTitle(suggestedDocumentTitle(file.name));}}/><small>PDF, CSV, Excel, Word · 3.5 MB</small></label>}
    {error&&<p role="alert">{error}</p>}
    {replacement ? <><input type="hidden" name="title" value={replacement.title}/><input type="hidden" name="category" value={replacement.category}/><input type="hidden" name="access_level" value="broker_only"/></> : <><label>{es?'Título':'Title'}<input name="title" value={title} onChange={e=>setTitle(e.target.value)} minLength={2} maxLength={160} required/></label>
    <label>{es?'Carpeta':'Folder'}<select name="category">{['Overview','Financial','Tax','Legal','Employees','Customers','Assets','Closing','Operations','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
    <label>{es?'Quién puede acceder':'Who can access this document?'}<select name="access_level" value={access} onChange={e=>setAccess(e.target.value as DocumentAccess)}><option value="broker_only">{es?'Solo yo (privado)':'Only me (private draft)'}</option><option value="approved">{es?'Comprador con aprobación financiera':'Buyer after financial-access approval'}</option><option value="nda_signed">{es?'Comprador después de firmar NDA':'Buyer after signing the NDA'}</option></select></label>
    <p role="status">{buyerCanReadDocument(access,ndaSigned,approved)?(es?'El comprador de este trato podrá acceder al documento.':'The buyer in this deal will be able to access this document.'):(es?'El comprador todavía no podrá acceder al documento.':'The buyer cannot access this document yet.')} {es?'No se comparte con otros compradores.':'It is not shared with other buyers.'}</p>
    {requests.length>0&&<label>{es?'Responde a una solicitud':'Fulfills a request'}<select name="request_id"><option value="">{es?'Ninguna':'None'}</option>{requests.map(r=><option key={r.id} value={r.id}>{r.item_name}</option>)}</select></label>}</>}
    <PendingAction disabled={Boolean(error)} pendingText={es?'Guardando y comprobando…':'Saving and checking…'}>{replacement ? (es?'Guardar nueva versión':'Save new version') : (es?'Guardar documento':'Save document')}</PendingAction>
    <small>{es?'Los archivos se comprueban antes de estar disponibles. Puedes cambiar el acceso después.':'Files are security-checked before release. You can change access after saving.'}</small>
  </form>;
}
