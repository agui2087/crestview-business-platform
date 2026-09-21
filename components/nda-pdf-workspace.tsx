'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {parseNdaLayout,fieldRole,fieldRequired,type NdaField,type NdaLayout,type SignerRole} from '@/lib/nda-fields';
import {parseSignatureAppearance,type SignatureAppearance} from '@/lib/nda-signature';
import {NdaSignaturePreview} from '@/components/nda-signature-preview';
import {NdaSignatureInput} from '@/components/nda-signature-input';
import {savePdfFields,signPreparedPdf,saveNdaPreset} from '@/app/[locale]/dashboard/signing/pdf-actions';
import styles from './nda-pdf-workspace.module.css';

export function NdaPdfWorkspace({mode,locale,source,recordId,version,layout,title,role='buyer',previous={},previousAppearances={},presets=[]}:{mode:'prepare'|'sign'|'preview';locale:string;source:string;recordId:string;version:number;layout:NdaLayout|null;title:string;role?:SignerRole;previous?:Record<string,string>;previousAppearances?:Partial<Record<SignerRole,SignatureAppearance>>;presets?:{id:string;name:string;layout:NdaLayout}[]}) {
 const router=useRouter();
 const es=locale==='es',preparing=mode==='prepare',t=(en:string,sp:string)=>es?sp:en;
 const [fields,setFields]=useState<NdaField[]>(()=>layout?parseNdaLayout(layout).fields:[]);
 const [order,setOrder]=useState<NdaLayout['order']>(layout?.order??'buyer_first'),[appearance,setAppearance]=useState<SignatureAppearance>({mode:'typed'}),[extra,setExtra]=useState<Record<string,string>>({}),[presetName,setPresetName]=useState('');
 const ownFields=fields.filter(f=>fieldRole(f)===role);
 const [document,setDocument]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[selected,setSelected]=useState(''),[zoom,setZoom]=useState(1);
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[sha,setSha]=useState(''),[text,setText]=useState('');
 const [name,setName]=useState(''),[initials,setInitials]=useState(''),[completed,setCompleted]=useState<string[]>([]),[accepted,setAccepted]=useState(false);
 const requiredFields=ownFields.filter(fieldRequired),requiredComplete=requiredFields.filter(f=>completed.includes(f.id)).length;
 const allEnteredConfirmed=ownFields.every(f=>!extra[f.id]?.trim()||completed.includes(f.id));
 const [rendered,setRendered]=useState(0),canvas=useRef<HTMLCanvasElement>(null),sheet=useRef<HTMLDivElement>(null);
 const [renderFailure,setRenderFailure]=useState(''),[focusField,setFocusField]=useState('');
 const pageReady=!!document&&!busy&&!renderFailure&&rendered===page;
 const drag=useRef<{id:string;startX:number;startY:number;x:number;y:number}|null>(null);
 const active=fields.find(f=>f.id===selected),label=(type:NdaField['type'])=>({signature:t('Signature','Firma'),initials:t('Initials','Iniciales'),date:t('Date (UTC)','Fecha (UTC)'),name:t('Full name','Nombre completo'),company:t('Company','Empresa'),title:t('Job title','Cargo'),text:t('Text','Texto'),checkbox:t('Checkbox','Casilla'),dropdown:t('Dropdown','Lista de opciones')})[type];
 const fieldText=(f:NdaField)=>previous[f.id]??(f.type==='signature'||f.type==='name'?name:f.type==='initials'?initials:f.type==='date'?new Date().toISOString().slice(0,10):extra[f.id]??'');
 useEffect(()=>{
  let cancelled=false;let task:ReturnType<typeof import('pdfjs-dist').getDocument>|undefined;
  void(async()=>{try{
   const response=await fetch(source,{cache:'no-store'});if(!response.ok)throw Error(t('PDF unavailable. Reload to check your access.','PDF no disponible. Actualiza para comprobar tu acceso.'));
   const bytes=await response.arrayBuffer();if(bytes.byteLength>3_500_000)throw Error(t('PDF is too large.','El PDF es demasiado grande.'));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
   if(!preparing&&layout?.sha256!==hash)throw Error(t('The original PDF does not match this signing request. Contact the broker.','El PDF original no coincide con esta solicitud. Contacta al corredor.'));
   const pdf=await import('pdfjs-dist');if(cancelled)return;
   pdf.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
   task=pdf.getDocument({data:bytes,useSystemFonts:true,useWasm:false,maxImageSize:16_000_000});
   task.onPassword=()=>{setError(t('Use an unlocked, unsigned PDF.','Usa un PDF sin contraseña ni firmas.'));setBusy(false);void task?.destroy();};
   const loaded=await task.promise;if(loaded.numPages>50)throw Error(t('Use a PDF with at most 50 pages.','Usa un PDF con un máximo de 50 páginas.'));
   if(!cancelled){setDocument(loaded);setSha(hash);}
  }catch(e){if(!cancelled){setError(e instanceof Error?e.message:t('Could not load PDF','No se pudo cargar el PDF'));setBusy(false);}}})();
  return()=>{cancelled=true;void task?.destroy();};
 // Layout and source are immutable for this mounted agreement.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[source]);
 useEffect(()=>{
  if(!document)return;let cancelled=false;let task:ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>|undefined;
  void(async()=>{try{
   setBusy(true);setRendered(0);setRenderFailure('');const p=await document.getPage(page);if(cancelled||!canvas.current)return;
   const b=p.getViewport({scale:1}),viewport=p.getViewport({scale:Math.min(1.5*zoom,Math.sqrt(6_000_000/(b.width*b.height)))});
   canvas.current.width=viewport.width;canvas.current.height=viewport.height;
   task=p.render({canvas:canvas.current,viewport});await task.promise;
   const content=await p.getTextContent();if(!cancelled){setText(content.items.map(i=>'str'in i?i.str:'').join(' '));setBusy(false);setRendered(page);}
  }catch{if(!cancelled){setRenderFailure(t('This page could not be rendered. Reload before signing.','No se pudo mostrar esta página. Actualiza antes de firmar.'));setBusy(false);}}})();
  return()=>{cancelled=true;task?.cancel();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[document,page,zoom]);
 useEffect(()=>{
  if(!focusField||!pageReady)return;
  const field=sheet.current?.querySelector<HTMLButtonElement>(`[data-nda-field="${focusField}"]`);
  if(field){field.focus();field.scrollIntoView({block:'nearest',inline:'nearest'});}
 },[focusField,pageReady]);
 function update(id:string,patch:Partial<NdaField>){setFields(fs=>fs.map(f=>f.id===id?{...f,...patch}:f));}
 function add(type:NdaField['type']){
  if(fields.length>=50)return;const id=crypto.randomUUID(),count=fields.filter(f=>f.page===page).length;
  setFields(fs=>[...fs,{id,type,...(type==='dropdown'?{options:['Option 1','Option 2']}:{ }),page,x:.08,y:Math.min(.1+count*.09,.85),width:type==='signature'?.38:.22,height:.055}]);setSelected(id);
 }
 function apply(field:NdaField){
  if(fieldRole(field)!==role)return;
  if(name.trim().length<2||(field.type==='initials'&&!initials.trim())){setError(t('Enter your full name and required initials first.','Primero escribe tu nombre completo y las iniciales requeridas.'));return;}
  if(!['signature','initials','date','name'].includes(field.type)&&!extra[field.id]?.trim()){setError(t('Complete this field in the signing controls first.','Completa este campo en los controles de firma primero.'));return;}
  if(field.type==='signature'){try{parseSignatureAppearance(appearance);}catch{setError(t('Complete your signature first.','Completa tu firma primero.'));return;}}
  setError('');setCompleted(c=>c.includes(field.id)?c:[...c,field.id]);
 }
 function nextField(){const next=requiredFields.find(f=>!completed.includes(f.id));if(next){setPage(next.page);setSelected(next.id);setFocusField(next.id);}}
 async function submit(){
  if(!pageReady)return;
  if(mode==='preview'){setError(t('Preview complete. Nothing was signed or sent.','Vista previa completada. No se firmó ni envió nada.'));return;}
  setSaving(true);setError('');try{
   const data=new FormData();data.set('locale',locale);
   if(preparing){data.set('listing_id',recordId);data.set('version',String(version));data.set('sha256',sha);data.set('fields',JSON.stringify(fields));data.set('order',order??'buyer_first');}
   else{data.set('nda_id',recordId);data.set('revision',layout!.revision);data.set('signer_name',name);data.set('initials',initials);data.set('completed',JSON.stringify(completed));data.set('appearance',JSON.stringify(appearance));data.set('extra',JSON.stringify(extra));if(accepted)data.set('accepted','on');}
   const result=await(preparing?savePdfFields(data):signPreparedPdf(data));
   if(result.url)router.push(result.url);else setError(result.error??t('Please try again.','Inténtalo de nuevo.'));
  }catch{setError(t('Connection interrupted. Refresh to check the status before trying again.','Conexión interrumpida. Actualiza para comprobar el estado antes de reintentar.'));}finally{setSaving(false);}
 }
 async function savePreset(){setSaving(true);setError('');try{const data=new FormData();data.set('listing_id',recordId);data.set('locale',locale);data.set('name',presetName);const result=await saveNdaPreset(data);if(result.error)setError(result.error);else{router.refresh();setPresetName('');}}catch{setError(t('Could not save. Check your connection and try again.','No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.'));}finally{setSaving(false);}}
 return <section className={styles.workspace} aria-label={t('Visual NDA workspace','Espacio visual del NDA')}>
  {mode==='preview'&&<p className="notice" role="status">{t('Signer preview only. Entries are temporary and cannot create a signature or send an invitation.','Solo vista previa. Los datos son temporales y no crean firmas ni envían invitaciones.')}</p>}
  <div className={styles.toolbar}><strong>{title}</strong><a href={source} target="_blank" rel="noreferrer">{t('Open original PDF','Abrir PDF original')}</a><button type="button" disabled={busy||page===1} onClick={()=>setPage(p=>p-1)}>{t('Previous page','Página anterior')}</button><span>{t('Page','Página')} {page} / {document?.numPages??'…'}</span><button type="button" disabled={busy||!document||page===document.numPages} onClick={()=>setPage(p=>p+1)}>{t('Next page','Página siguiente')}</button></div>
  <label className={styles.zoom}>{t('PDF zoom','Ampliación del PDF')} <select value={zoom} disabled={busy} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>100%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label>
  {(renderFailure||error)&&<p className={styles.error} role="alert">{renderFailure||error}</p>}
  <div className={styles.columns}>
   <aside className={styles.controls}>
    {preparing?<><h2>{t('Place fields','Colocar campos')}</h2><p>{t('Add a field, then drag it into place. You can also set its position with the controls below. Assign fields to the buyer or broker. Identity fields are required; other fields can be optional.','Añade un campo y arrástralo a su posición, o usa los controles inferiores. Asigna campos al comprador o corredor. Los campos de identidad son obligatorios; los demás pueden ser opcionales.')}</p><label>{t('Signing order','Orden de firma')}<select aria-label={t('Signing order','Orden de firma')} value={order} onChange={e=>setOrder(e.target.value as NdaLayout['order'])}><option value="buyer_first">{t('Buyer first','Comprador primero')}</option><option value="broker_first">{t('Broker first','Corredor primero')}</option><option value="any">{t('Either order','Cualquier orden')}</option></select></label><div className={styles.add}>{(['signature','initials','date','name','company','title','text','checkbox','dropdown'] as const).map(type=><button disabled={busy||saving||!document||fields.length>=50} type="button" key={type} onClick={()=>add(type)}>{t('Add','Añadir')} {label(type)}</button>)}</div>
    {active&&<fieldset disabled={saving}><legend>{label(active.type)} · {t('Page','Página')} {active.page}</legend><label>{t('Assigned signer','Firmante asignado')}<select aria-label={t('Assigned signer','Firmante asignado')} value={fieldRole(active)} onChange={e=>update(active.id,{role:e.target.value as SignerRole})}><option value="buyer">{t('Buyer','Comprador')}</option><option value="broker">{t('Broker','Corredor')}</option></select></label><label>{t('Field label','Etiqueta del campo')}<input maxLength={60} value={active.label??''} onChange={e=>update(active.id,{label:e.target.value})}/></label>{!['signature','initials','date','name'].includes(active.type)&&<label><input type="checkbox" checked={fieldRequired(active)} onChange={e=>update(active.id,{required:e.target.checked})}/>{t('Required field','Campo obligatorio')}</label>}{active.type==='dropdown'&&<label>{t('Choices, one per line (2–12)','Opciones, una por línea (2–12)')}<textarea value={(active.options??[]).join('\n')} onChange={e=>update(active.id,{options:e.target.value.split('\n')})}/></label>}{active.type==='text'&&<label>{t('Validation','Validación')}<select value={active.validation??'text'} onChange={e=>update(active.id,{validation:e.target.value as NdaField['validation']})}><option value="text">{t('Text','Texto')}</option><option value="email">Email</option><option value="number">{t('Number','Número')}</option></select></label>}{(['x','y','width','height'] as const).map(key=><label key={key}>{({x:t('Left (%)','Izquierda (%)'),y:t('Top (%)','Arriba (%)'),width:t('Width (%)','Ancho (%)'),height:t('Height (%)','Alto (%)')})[key]}<input type="number" min={key==='width'?8:key==='height'?2.5:0} max={key==='width'?80:key==='height'?20:100} step="0.5" value={Math.round(active[key]*1000)/10} onChange={e=>update(active.id,{[key]:Number(e.target.value)/100})}/></label>)}<button type="button" onClick={()=>{setFields(fs=>fs.filter(f=>f.id!==active.id));setSelected('');}}>{t('Remove field','Eliminar campo')}</button></fieldset>}
    <label>{t('Reuse a saved layout for this PDF','Reutilizar diseño para este PDF')}<select aria-label={t('Reuse a saved layout for this PDF','Reutilizar diseño para este PDF')} defaultValue="" onChange={e=>{const p=presets.find(p=>p.id===e.target.value);if(p){const l=parseNdaLayout(p.layout);if(l.sha256!==sha){setError(t('This preset belongs to a different PDF.','Este diseño pertenece a otro PDF.'));return;}setFields(l.fields);setOrder(l.order??'buyer_first');}}}><option value="">{t('Choose a preset','Elegir diseño')}</option>{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className={styles.primary} type="button" disabled={!pageReady||saving||!fields.some(f=>f.type==='signature')||!sha} onClick={()=>void submit()}>{saving?t('Saving…','Guardando…'):t('Save fields for future NDAs','Guardar campos para futuros NDA')}</button><p>{t('Existing requests and signed documents will not be changed.','Las solicitudes existentes y los documentos firmados no cambiarán.')}</p><label>{t('Preset name','Nombre del diseño')}<input value={presetName} maxLength={80} onChange={e=>setPresetName(e.target.value)}/></label><button type="button" disabled={saving||!layout||presetName.trim().length<2} onClick={()=>void savePreset()}>{t('Save current saved layout as preset','Guardar diseño ya guardado como plantilla')}</button><p>{t('Save fields first. Presets match the exact PDF, not a different document.','Guarda los campos primero. Las plantillas requieren el mismo PDF.')}</p></>:
    <><h2>{t('Your signature','Tu firma')}</h2><label>{t('Full legal name','Nombre legal completo')}<input maxLength={100} value={name} disabled={saving} onChange={e=>{setName(e.target.value);setCompleted([]);setAccepted(false);}} autoComplete="name"/></label>{ownFields.some(f=>f.type==='initials')&&<label>{t('Your initials','Tus iniciales')}<input maxLength={12} value={initials} disabled={saving} onChange={e=>{setInitials(e.target.value);setCompleted([]);setAccepted(false);}}/></label>}<NdaSignatureInput es={es} value={appearance} disabled={saving} onChange={v=>{setAppearance(v);setCompleted([]);setAccepted(false);}}/>{ownFields.filter(f=>['company','title','text','checkbox','dropdown'].includes(f.type)).map(f=><label key={f.id}>{f.label||label(f.type)}{!fieldRequired(f)?t(' (optional)',' (opcional)'):''}{f.type==='dropdown'?<select value={extra[f.id]??''} disabled={saving} onChange={e=>{setExtra({...extra,[f.id]:e.target.value});setCompleted(c=>c.filter(id=>id!==f.id));setAccepted(false);}}><option value="">{t('Choose an option','Elige una opción')}</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:f.type==='checkbox'?<input type="checkbox" checked={extra[f.id]==='Yes'} disabled={saving} onChange={e=>{setExtra({...extra,[f.id]:e.target.checked?'Yes':''});setCompleted(c=>c.filter(id=>id!==f.id));setAccepted(false);}}/>:<input maxLength={100} value={extra[f.id]??''} disabled={saving} onChange={e=>{setExtra({...extra,[f.id]:e.target.value});setCompleted(c=>c.filter(id=>id!==f.id));setAccepted(false);}}/>}</label>)}<p>{t('Click each marked field to apply your signature and required information. Nothing is signed until you confirm below.','Pulsa cada campo marcado para aplicar tu firma y los datos obligatorios. Nada queda firmado hasta confirmar abajo.')}</p><progress max={requiredFields.length} value={requiredComplete} aria-label={t('Required fields completed','Campos obligatorios completados')}/><p role="status">{requiredComplete} / {requiredFields.length} {t('fields completed','campos completados')}</p><button type="button" onClick={nextField} disabled={saving||requiredComplete===requiredFields.length}>{t('Go to next required field','Ir al siguiente campo obligatorio')}</button><label className={styles.consent}><input type="checkbox" checked={accepted} disabled={saving} onChange={e=>setAccepted(e.target.checked)}/>{t('I have reviewed the complete agreement and agree to sign it electronically using the name and initials shown.','He revisado el acuerdo completo y acepto firmarlo electrónicamente con el nombre y las iniciales indicados.')}</label><button className={styles.primary} type="button" disabled={!pageReady||saving||!accepted||!allEnteredConfirmed||requiredComplete!==requiredFields.length||name.trim().length<2} onClick={()=>void submit()}>{saving?t('Creating signed PDF…','Creando PDF firmado…'):mode==='preview'?t('Finish preview (does not sign)','Finalizar vista previa (no firma)'):t('Confirm and sign NDA','Confirmar y firmar NDA')}</button><p>{t('The date is recorded in UTC. A completed PDF is available after every assigned party signs.','La fecha se registra en UTC. El PDF completado estará disponible cuando firmen todas las partes.')}</p></>}
    <h3>{t('All fields','Todos los campos')}</h3><ol className={styles.fieldList}>{fields.map((f,i)=><li key={f.id}><button type="button" disabled={saving} aria-pressed={selected===f.id} onClick={()=>{setPage(f.page);setSelected(f.id);}}>{i+1}. {label(f.type)} · {t('page','página')} {f.page}{completed.includes(f.id)?t(' · completed',' · completado'):''}</button></li>)}</ol>
   </aside>
   <div className={styles.document} tabIndex={0} role="region" aria-label={t('Scrollable PDF page','Página PDF desplazable')}>{busy&&<p role="status">{t('Loading PDF page…','Cargando página del PDF…')}</p>}<div className={styles.sheet} style={{width:`${zoom*100}%`}} ref={sheet} onPointerMove={e=>{
    if(!drag.current||!sheet.current||saving)return;const box=sheet.current.getBoundingClientRect(),f=fields.find(f=>f.id===drag.current!.id);if(!f)return;
    update(f.id,{x:Math.max(0,Math.min(1-f.width,drag.current.x+(e.clientX-drag.current.startX)/box.width)),y:Math.max(0,Math.min(1-f.height,drag.current.y+(e.clientY-drag.current.startY)/box.height))});
   }} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
    <canvas ref={canvas} aria-label={`${title}, ${t('page','página')} ${page}`} role="img"/>
    {rendered===page&&fields.filter(f=>f.page===page).map(f=><button type="button" key={f.id} data-nda-field={f.id} aria-label={`${preparing?t('Position','Posicionar'):t('Apply','Aplicar')} ${label(f.type)} ${fields.indexOf(f)+1}`} aria-pressed={selected===f.id||completed.includes(f.id)} className={`${styles.field} ${(completed.includes(f.id)||previous[f.id])?styles.completed:''}`} style={{left:`${f.x*100}%`,top:`${f.y*100}%`,width:`${f.width*100}%`,height:`${f.height*100}%`,fontStyle:f.type==='signature'&&(completed.includes(f.id)||previous[f.id])?'italic':undefined}} disabled={saving||busy||(!preparing&&fieldRole(f)!==role)} onPointerDown={e=>{if(!preparing)return;setSelected(f.id);e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:f.id,startX:e.clientX,startY:e.clientY,x:f.x,y:f.y};}} onClick={()=>{setSelected(f.id);if(!preparing)apply(f);}} onKeyDown={e=>{if(!preparing)return;const delta=e.shiftKey?.02:.005;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();update(f.id,{x:Math.max(0,Math.min(1-f.width,f.x+(e.key==='ArrowRight'?delta:e.key==='ArrowLeft'?-delta:0))),y:Math.max(0,Math.min(1-f.height,f.y+(e.key==='ArrowDown'?delta:e.key==='ArrowUp'?-delta:0)))});}}}>{completed.includes(f.id)||previous[f.id]?f.type==='signature'?<NdaSignaturePreview appearance={previous[f.id]?(previousAppearances[fieldRole(f)]??{mode:'typed'}):appearance} name={fieldText(f)} es={es}/>:fieldText(f):`${f.label||label(f.type)}${fieldRole(f)==='broker'?t(' · Broker',' · Corredor'):''}`}</button>)}
   </div>{text&&<details><summary>{t('Accessible text of this page','Texto accesible de esta página')}</summary><p>{text}</p></details>}</div>
  </div>
 </section>;
}
