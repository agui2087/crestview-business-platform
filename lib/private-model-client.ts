import {z} from 'zod';
import {PRIVATE_MODEL_ENDPOINT,privateAnalysisPrompt,validatePageFindings} from './private-analysis.ts';

// Leave five minutes of the database's 40-minute lease for completion/cleanup.
export const PRIVATE_JOB_BUDGET_MS=35*60*1000;
export const PRIVATE_MODEL_ATTEMPT_MS=180000;
const correction='The response failed source validation. Re-read the original page. Correct every reportedValue to a verbatim substring of its evidence. Correct every nonempty period to a verbatim substring of the original page; use an empty period if uncertain. Do not invent a period or omit digits. Return the complete corrected JSON only.';
const format={type:'object',properties:{findings:{type:'array',maxItems:15,items:{type:'object',properties:{metric:{type:'string'},reportedValue:{type:'string'},period:{type:'string'},page:{type:'integer'},evidence:{type:'string'},uncertainty:{type:'string'}},required:['metric','reportedValue','period','page','evidence','uncertainty'],additionalProperties:false}}},required:['findings'],additionalProperties:false};

export async function analyzePrivatePage(input:{model:string,page:number,language:string,text:string,deadline:number},dependencies:{fetch?:typeof fetch,now?:()=>number}={}){
  const request=dependencies.fetch??fetch;
  const now=dependencies.now??Date.now;
  const messages=[{role:'system',content:privateAnalysisPrompt},{role:'user',content:JSON.stringify({page:input.page,language:input.language,text:input.text})}];
  for(let attempt=0;attempt<2;attempt++){
    const remaining=input.deadline-now();
    if(remaining<=0)throw new Error('worker_unavailable');
    let payload:unknown;
    try{
      const response=await request(PRIVATE_MODEL_ENDPOINT,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(Math.max(1,Math.min(PRIVATE_MODEL_ATTEMPT_MS,Math.floor(remaining)))),body:JSON.stringify({model:input.model,stream:false,keep_alive:0,format,options:{temperature:0,num_ctx:8192,num_predict:2000},messages})});
      if(!response.ok)throw new Error();
      payload=await response.json();
    }catch{throw new Error('model_unavailable');}
    if(now()>=input.deadline)throw new Error('worker_unavailable');
    const message=z.object({message:z.object({content:z.string().max(100000)})}).safeParse(payload);
    if(!message.success)throw new Error('invalid_result');
    const content=message.data.message.content;
    try{return validatePageFindings(JSON.parse(content),input.page,input.text);}catch{
      if(attempt===1)throw new Error('invalid_result');
      messages.push({role:'assistant',content},{role:'user',content:correction});
    }
  }
  throw new Error('invalid_result');
}
