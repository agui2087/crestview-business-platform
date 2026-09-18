import {notFound} from 'next/navigation';
import Link from 'next/link';
import {isLocale} from '@/lib/i18n';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {PrintRecord} from '@/components/print-record';
import './record.css';
export const dynamic='force-dynamic';
export const metadata={title:'NDA signing record',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function AgreementRecord({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;
  if(!isLocale(locale))notFound();
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)notFound();
  const {data:nda,error}=await supabase.from('deal_ndas').select('id,buyer_id,broker_id,document_name,template_body,template_version,storage_path,sent_at,signed_at,signer_name,signature_record,document_fingerprint').eq('inquiry_id',id).eq('status','signed').or(`buyer_id.eq.${user.id},broker_id.eq.${user.id}`).maybeSingle();
  if(error||!nda)notFound();
  const file=nda.storage_path?await supabase.storage.from('deal-files').createSignedUrl(nda.storage_path,900,{download:true}):null;
  const record=(nda.signature_record??{}) as {file_sha256?:string;record_version?:number;consent?:string;method?:string};
  return <main className="shell signing-record" style={{paddingBlock:40,overflowWrap:'anywhere'}}>
    <Link href={`/${locale}/dashboard/deals/${id}`}>{locale==='es'?'Volver al trato':'Back to deal'}</Link>
    <h1>{locale==='es'?'Registro de firma del NDA':'NDA signing record'}</h1><h2>{nda.document_name}</h2>
    <p>This record documents an electronic acceptance recorded by Crestview. It is not an independent identity verification, legal opinion, or certificate issued by DocuSign.</p>
    <dl><dt>Agreement ID</dt><dd>{nda.id}</dd><dt>Agreement version</dt><dd>{nda.template_version}</dd><dt>Signer</dt><dd>{nda.signer_name}</dd><dt>Signer account ID</dt><dd>{nda.buyer_id}</dd><dt>Sent (UTC)</dt><dd>{nda.sent_at?new Date(nda.sent_at).toISOString():'Not recorded'}</dd><dt>Signed (UTC)</dt><dd>{nda.signed_at?new Date(nda.signed_at).toISOString():'Not recorded'}</dd><dt>Method</dt><dd>{record.method??'Electronic acceptance'}</dd><dt>Recorded consent</dt><dd>{record.consent??'See original agreement and historical signature record.'}</dd><dt>Agreement fingerprint</dt><dd>{nda.document_fingerprint??'Not recorded for this historical agreement'}</dd><dt>Original PDF SHA-256</dt><dd>{record.file_sha256??'Not recorded for this agreement; no PDF hash is being inferred.'}</dd></dl>
    {file?.data?.signedUrl?<a className="button button--light" href={file.data.signedUrl}>Download original agreement PDF</a>:nda.storage_path?<p role="alert">Original PDF unavailable. Contact the broker; this record does not replace the agreement.</p>:<section><h2>Agreement text</h2><p style={{whiteSpace:'pre-wrap'}}>{nda.template_body}</p></section>}
    <p>Keep the original agreement together with this signing record. Printing this page does not embed the original PDF. Financial-document access still requires the broker’s separate approval.</p>
    <PrintRecord locale={locale}/>
  </main>;
}
