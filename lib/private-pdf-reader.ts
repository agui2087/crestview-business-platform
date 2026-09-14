import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const documentErrors=new Set(['unreadable_pdf','page_limit','page_too_large','ocr_required']);
/** Only the reader's explicit validation failures describe the document.
 * A killed/missing process or broken protocol describes the processor instead.
 * Never propagate stderr, paths, document text or raw exception messages.
 */
export function parsePrivatePdfOutput(error:unknown,stdout:string):string[]{
  if(error)throw new Error('worker_unavailable');
  let result;
  try{result=JSON.parse(stdout);}catch{throw new Error('worker_unavailable');}
  if(!result||typeof result!=='object')throw new Error('worker_unavailable');
  if(result.error)throw new Error(documentErrors.has(result.error)?result.error:'worker_unavailable');
  if(!Array.isArray(result.pages)||!result.pages.length||result.pages.length>30||result.pages.some((page:unknown)=>typeof page!=='string'||!page.trim()||page.length>12000||Buffer.byteLength(page,'utf8')>6000))throw new Error('worker_unavailable');
  return result.pages;
}
export async function recoverPrivatePdfReader(read:()=>Promise<string[]>):Promise<string[]>{
  try{return await read();}
  catch(error){
    // One sequential restart only for reader infrastructure failures. Explicit
    // document failures remain final; no parser/security checks are weakened.
    if(!(error instanceof Error)||error.message!=='worker_unavailable')throw error;
    return read();
  }
}
export function extractPrivatePdf(bytes:Buffer):Promise<string[]>{
  return recoverPrivatePdfReader(()=>extractOnce(bytes));
}
function extractOnce(bytes:Buffer):Promise<string[]>{
  return new Promise((resolve,reject)=>{
    const child=execFile(process.execPath,['--max-old-space-size=256',fileURLToPath(new URL('../scripts/private-pdf-text.mjs',import.meta.url))],{timeout:60000,maxBuffer:600000},(error,stdout)=>{
      try{resolve(parsePrivatePdfOutput(error,stdout));}catch(failure){reject(failure);}
    });
    child.stdin?.on('error',()=>{});child.stdin?.end(bytes);
  });
}
