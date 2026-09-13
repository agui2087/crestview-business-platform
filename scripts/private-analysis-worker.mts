import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {localModelName,PRIVATE_ANALYSIS_MAX_BYTES,privateAnalysisResultSchema} from '../lib/private-analysis.ts';

import {analyzePrivatePage,PRIVATE_JOB_BUDGET_MS} from '../lib/private-model-client.ts';

const model=localModelName();
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!key)throw new Error('Private worker database configuration required');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(60000)})}});
function extract(bytes:Buffer):Promise<string[]>{
  return new Promise((resolve,reject)=>{
    const child=execFile(process.execPath,['--max-old-space-size=256',fileURLToPath(new URL('./private-pdf-text.mjs',import.meta.url))],{timeout:60000,maxBuffer:600000},(error,stdout)=>{
      if(error)return reject(new Error('unreadable_pdf'));
      try{const result=JSON.parse(stdout);if(result.error)throw new Error(result.error);if(!Array.isArray(result.pages)||!result.pages.length)throw new Error('unreadable_pdf');resolve(result.pages);}catch(error){reject(error);}
    });
    child.stdin?.on('error',()=>{});child.stdin?.end(bytes);
  });
}
async function runOne(){
  const {data,error}=await client.rpc('claim_private_document_analysis');
  if(error)throw new Error('Queue unavailable');
  const job=data?.[0];if(!job)return false;
  const deadline=Date.now()+PRIVATE_JOB_BUDGET_MS;
  let result=null;let failure:string|null=null;
  try{
    if(job.size_bytes<1||job.size_bytes>PRIVATE_ANALYSIS_MAX_BYTES)throw new Error('source_unavailable');
    const download=await client.storage.from('vault-files').download(job.storage_key);
    if(download.error||!download.data||download.data.size!==Number(job.size_bytes))throw new Error('source_unavailable');
    const bytes=Buffer.from(await download.data.arrayBuffer());
    if(bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==job.document_sha256)throw new Error('source_unavailable');
    const pages=await extract(bytes);bytes.fill(0);
    const findings=[];
    for(let i=0;i<pages.length;i++){
      findings.push(...await analyzePrivatePage({model,page:i+1,language:job.locale,text:pages[i],deadline}));
      pages[i]='';
    }
    result=privateAnalysisResultSchema.parse({findings,pageCount:pages.length,model,limitations:['AI-generated extraction requires review against the original document. No saved financial figures were changed.']});
  }catch(error){failure=error instanceof Error?error.message:'worker_unavailable';}
  const finished=await client.rpc('finish_private_document_analysis',{p_id:job.id,p_lease_token:job.lease_token,p_result:result,p_failure_code:failure});
  if(finished.error)throw new Error('Unable to save processing status');
  console.log(finished.data?'Document processing attempt finished.':'Expired processing result discarded.');
  return true;
}
// Exactly one job at a time. No document text, names, IDs, or credentials in logs.
do{
  try{await runOne();}catch{console.error('Private processor unavailable; queued work remains in storage.');}
  if(process.argv.includes('--once'))break;
  await delay(15000);
}while(true);
