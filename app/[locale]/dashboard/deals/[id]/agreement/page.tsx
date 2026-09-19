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
  const file=nda.storage_path?await supabase.storage.from('deal-files').createSignedUrl(nda.storage_path,900,{download:true}):null;
  const record=(nda.signature_record??{}) as {file_sha256?:string;record_version?:number;consent?:string;method?:string};
  const fields=[
    [t('Agreement ID','ID del acuerdo'),nda.id],
    [t('Agreement version','Versión del acuerdo'),nda.template_version],
    [t('Signer','Firmante'),nda.signer_name],
    [t('Signer account ID','ID de cuenta del firmante'),nda.buyer_id],
    [t('Sent (UTC)','Enviado (UTC)'),nda.sent_at?new Date(nda.sent_at).toISOString():t('Not recorded','No registrado')],
    [t('Signed (UTC)','Firmado (UTC)'),nda.signed_at?new Date(nda.signed_at).toISOString():t('Not recorded','No registrado')],
    [t('Method','Método'),record.method==='typed_signature'?t('Typed electronic signature','Firma electrónica escrita'):record.method??t('Electronic acceptance','Aceptación electrónica')],
    [t('Recorded consent (original wording)','Consentimiento registrado (texto original)'),record.consent??t('See original agreement and historical signature record.','Consulta el acuerdo original y el registro histórico de firma.')],
    [t('Agreement fingerprint','Huella digital del acuerdo'),nda.document_fingerprint??t('Not recorded for this historical agreement','No registrada para este acuerdo histórico')],
    [t('Original PDF SHA-256','SHA-256 del PDF original'),record.file_sha256??t('Not recorded for this agreement; no PDF hash is being inferred.','No registrado para este acuerdo; no se infiere ninguna huella del PDF.')],
  ];
  return <main className="shell signing-record" style={{paddingBlock:40,overflowWrap:'anywhere'}}>
    <Link href={`/${locale}/dashboard/deals/${id}`}>{locale==='es'?'Volver al trato':'Back to deal'}</Link>
    <h1>{locale==='es'?'Registro de firma del NDA':'NDA signing record'}</h1><h2>{nda.document_name}</h2>
    <p>{t('This record documents an electronic acceptance recorded by Crestview. It is not an independent identity verification, legal opinion, or certificate issued by DocuSign.','Este registro documenta una aceptación electrónica registrada por Crestview. No constituye verificación independiente de identidad, asesoría legal ni un certificado emitido por DocuSign.')}</p>
    <dl>{fields.map(([label,value])=><Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}</dl>
    {file?.data?.signedUrl?<a className="button button--light" href={file.data.signedUrl}>{t('Download original agreement PDF','Descargar el PDF del acuerdo original')}</a>:nda.storage_path?<p role="alert">{t('Original PDF unavailable. Contact the broker; this record does not replace the agreement.','PDF original no disponible. Contacta al corredor; este registro no sustituye el acuerdo.')}</p>:<section><h2>{t('Agreement text','Texto del acuerdo')}</h2><p style={{whiteSpace:'pre-wrap'}}>{nda.template_body}</p></section>}
    <p>{t('Keep the original agreement together with this signing record. Printing this page does not embed the original PDF. Financial-document access still requires the broker’s separate approval.','Conserva el acuerdo original junto con este registro. Imprimir esta página no incluye el PDF original. El acceso a documentos financieros aún requiere aprobación independiente del corredor.')}</p>
    <PrintRecord locale={locale}/>
  </main>;
}
