"use client";
import {useEffect,useState} from 'react';
import {privateAnalysisResultSchema,type PrivateAnalysisResult} from '@/lib/private-analysis';
import {z} from 'zod';
type Job={status:'queued'|'processing'|'completed'|'failed';result:PrivateAnalysisResult|null};
export function PrivateDocumentAnalysis({documentId,locale}:{documentId:string;locale:string}){
  const es=locale==='es';
  const [job,setJob]=useState<Job|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function refresh(){
      try{const response=await fetch(`/api/documents/${documentId}/analysis`,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error();const payload=z.object({job:z.object({status:z.enum(['queued','processing','completed','failed']),result:privateAnalysisResultSchema.nullable()}).nullable()}).parse(await response.json());setJob(payload.job);setError(false);}
      catch{if(!controller.signal.aborted)setError(true);}
      if(!controller.signal.aborted)timer=setTimeout(refresh,15000);
    }
    void refresh();return()=>{controller.abort();clearTimeout(timer);};
  },[documentId]);
  async function queue(){
    setBusy(true);setError(false);
    try{const response=await fetch(`/api/documents/${documentId}/analysis`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale:es?'es':'en',consent})});if(!response.ok)throw new Error();setJob({status:'queued',result:null});}
    catch{setError(true);}finally{setBusy(false);}
  }
  const pending=job?.status==='queued'||job?.status==='processing';
  return <details className="panel" style={{padding:'1rem',minWidth:0,overflowWrap:'anywhere'}}>
    <summary>{es?'Análisis privado del PDF · Pro':'Private PDF analysis · Pro'}</summary>
    <p>{es?'El análisis puede tardar más tiempo. Puedes seguir usando Crestview mientras tu documento está en cola.':'Document analysis may take additional time. You can continue using Crestview while your document is queued.'}</p>
    <p>{es?'PDF con texto: hasta 10 MB y 30 páginas. Los documentos escaneados requieren atención. No modifica tus cifras guardadas.':'Text-based PDFs: up to 10 MB and 30 pages. Scanned documents require attention. Your saved figures will not be changed.'}</p>
    <p role="status" aria-live="polite">{job&&({queued:es?'En cola':'Queued',processing:es?'Procesando':'Processing',completed:es?'Completado — requiere revisión':'Completed — review required',failed:es?'Requiere atención. Revisa el PDF y vuelve a intentarlo más tarde.':'Needs attention. Check the PDF and try again later.'}[job.status])}</p>
    {!pending&&<><label style={{display:'flex',gap:'.6rem',alignItems:'flex-start'}}><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>{es?'Autorizo el procesamiento de este documento en equipos controlados por Crestview, sin enviarlo a un servicio de IA alojado. Revisaré los resultados.':'I authorize processing this document on Crestview-controlled equipment, without sending it to a hosted AI service. I will review the results.'}</span></label><button type="button" disabled={!consent||busy} onClick={()=>void queue()}>{busy?(es?'Enviando…':'Submitting…'):(es?'Solicitar análisis':'Request analysis')}</button></>}
    {error&&<p role="alert">{es?'No se pudo actualizar el análisis. Comprueba tu acceso Pro, conexión y límite de solicitudes.':'Unable to update analysis. Check your Pro access, connection, and request allowance.'}</p>}
    {job?.status==='completed'&&job.result&&<div><p>{es?'Resultados generados por IA, no verificados. Confirma cada cifra en el original antes de usarla.':'AI-generated, unverified results. Confirm every figure against the original before using it.'}</p>{job.result.findings.length===0?<p>{es?'No se identificaron cifras respaldadas por el texto. Revisa el original.':'No source-supported figures were identified. Review the original.'}</p>:<ul>{job.result.findings.map((finding,index)=><li key={index}><strong>{finding.metric}: {finding.reportedValue}</strong><p>{finding.period} · {es?'Página':'Page'} {finding.page}</p><blockquote>{finding.evidence}</blockquote>{finding.uncertainty&&<p>{finding.uncertainty}</p>}</li>)}</ul>}</div>}
  </details>;
}
