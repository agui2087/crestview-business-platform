import {notFound} from 'next/navigation';
import Link from 'next/link';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {PrintRecord} from '@/components/print-record';
import './record.css';
import {Fragment} from 'react';
export const dynamic='force-dynamic';
export const metadata={title:'NDA signing record',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function AgreementRecord({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;
  if(!isLocale(locale))notFound();
  const t=(en:string,es:string)=>locale==='es'?es:en;
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)notFound();
  const {data:nda,error}=await supabase.from('deal_ndas').select('id,buyer_id,broker_id,document_name,template_body,template_version,storage_path,sent_at,signed_at,signer_name,signature_record,document_fingerprint').eq('inquiry_id',id).eq('status','signed').or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
  if(error||!nda)notFound();
  const {data:events,error:eventsError}=await supabase.from('deal_nda_events').select('id,event_type,occurred_at').eq('nda_id',nda.id).order('occurred_at');
  if(eventsError)throw Error('Signing history temporarily unavailable. Please refresh.');
  const {data:visual,error:visualError}=await supabase.from('deal_nda_pdf_records').select('sha256').eq('nda_id',nda.id).maybeSingle();
  if(visualError)throw Error('Completed PDF evidence temporarily unavailable.');
  const {data:participants,error:participantError}=await supabase.from('deal_nda_signatures').select('role,legal_name,signer_id,signed_at,appearance').eq('nda_id',nda.id).order('signed_at');
  if(participantError)throw Error('Participant evidence temporarily unavailable.');
  const record=(nda.signature_record??{}) as {file_sha256?:string;record_version?:number;consent?:string;method?:string};
  const fields=[
    [t('Agreement ID','ID del acuerdo'),nda.id],
    [t('Agreement version','Versión del acuerdo'),nda.template_version],
    [t('Buyer signer','Firmante comprador'),nda.signer_name],
    [t('Buyer account ID','ID de cuenta del comprador'),nda.buyer_id],
    [t('Sent (UTC)','Enviado (UTC)'),nda.sent_at?new Date(nda.sent_at).toISOString():t('Not recorded','No registrado')],
    [t('Signed (UTC)','Firmado (UTC)'),nda.signed_at?new Date(nda.signed_at).toISOString():t('Not recorded','No registrado')],
    [t('Method','Método'),record.method==='typed_signature'?t('Typed electronic signature','Firma electrónica escrita'):record.method==='account_based_electronic_signature'?t('Account-based electronic signature','Firma electrónica con cuenta'):record.method??t('Electronic acceptance','Aceptación electrónica')],
    [t('Recorded consent (original wording)','Consentimiento registrado (texto original)'),record.consent??t('See original agreement and historical signature record.','Consulta el acuerdo original y el registro histórico de firma.')],
    [t('Agreement fingerprint','Huella digital del acuerdo'),nda.document_fingerprint??t('Not recorded for this historical agreement','No registrada para este acuerdo histórico')],
    [t('Original PDF SHA-256','SHA-256 del PDF original'),record.file_sha256??t('Not recorded for this agreement; no PDF hash is being inferred.','No registrado para este acuerdo; no se infiere ninguna huella del PDF.')],
  ];
  return <main className="shell signing-record" style={{paddingBlock:40,overflowWrap:'anywhere'}}>
    <Link href={`/${locale}/dashboard/deals/${id}`}>{locale==='es'?'Volver al trato':'Back to deal'}</Link>
    <h1>{locale==='es'?'Registro de firma del NDA':'NDA signing record'}</h1><h2>{nda.document_name}</h2>
    <p>{t('This record documents an electronic acceptance recorded by Crestview. It is not an independent identity verification, legal opinion, or certificate issued by DocuSign.','Este registro documenta una aceptación electrónica registrada por Crestview. No constituye verificación independiente de identidad, asesoría legal ni un certificado emitido por DocuSign.')}</p>
    <dl>{fields.map(([label,value])=><Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}</dl>
    {!!participants?.length&&<section><h2>{t('Signing participants','Participantes firmantes')}</h2>{participants.map(p=><div key={p.role}><h3>{p.role==='buyer'?t('Buyer','Comprador'):t('Broker','Corredor')}</h3><p>{p.legal_name} · {new Date(p.signed_at).toISOString()}</p><p>{t('Account','Cuenta')}: {p.signer_id}</p><p>{t('Signature appearance','Aspecto de firma')}: {p.appearance?.mode==='drawn'?t('Drawn','Dibujada'):p.appearance?.mode==='uploaded'?t('Uploaded image','Imagen subida'):t('Typed','Escrita')}</p></div>)}</section>}
    {visual&&<section><h2>{t('Completed agreement','Acuerdo completado')}</h2><a className="button button--primary" href={`/api/deals/${id}/signing-record?format=signed`}>{t('Download signed PDF','Descargar PDF firmado')}</a><p>{t('Completed PDF SHA-256','SHA-256 del PDF completado')}: {visual.sha256}</p></section>}
    {nda.storage_path?<><a className="button button--light" href={`/api/deals/${id}/signing-record?format=original`}>{t('Download original agreement PDF','Descargar el PDF del acuerdo original')}</a><p>{t('The original download is checked against its recorded PDF fingerprint. Historical PDFs without a recorded fingerprint cannot be verified by this download.','La descarga se comprueba con la huella registrada del PDF. Los PDF históricos sin huella registrada no pueden verificarse mediante esta descarga.')}</p></>:<section><h2>{t('Agreement text','Texto del acuerdo')}</h2><p style={{whiteSpace:'pre-wrap'}}>{nda.template_body}</p></section>}
    <a className="button button--light" href={`/api/deals/${id}/signing-record`}>{t('Download evidence record (JSON)','Descargar registro de evidencia (JSON)')}</a>
    <h2>{t('Recorded workflow history','Historial registrado')}</h2><p>{t('Events before this tracking feature was introduced may not appear. Receipt acknowledgment is not a signature or proof that every page was read.','Es posible que no aparezcan eventos anteriores a esta función. Confirmar recepción no es firmar ni probar que se leyó cada página.')}</p>
    <ol>{(events??[]).map(e=><li key={e.id}>{e.event_type.replaceAll('_',' ')} · {new Date(e.occurred_at).toISOString()}</li>)}</ol>
    <p>{t('Keep the original agreement together with this signing record. Printing this page does not embed the original PDF. Financial-document access still requires the broker’s separate approval.','Conserva el acuerdo original junto con este registro. Imprimir esta página no incluye el PDF original. El acceso a documentos financieros aún requiere aprobación independiente del corredor.')}</p>
    <PrintRecord locale={locale}/>
  </main>;
}
