const MAX_BYTES=2*1024*1024;
export async function checkEndpoint(check,{origin,timeoutMs,maxLatencyMs,fetchImpl=fetch,clock=()=>performance.now(),now=()=>Date.now()}){
  const start=clock();
  let status=0;
  try{
    const response=await fetchImpl(`${origin}${check.path}`,{redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{'user-agent':'Crestview-Production-Monitor/2.0'}});
    status=response.status;
    if(!response.ok)throw new Error('http');
    const type=response.headers.get('content-type')??'';
    if(!type.includes(check.json?'application/json':'text/html'))throw new Error('content');
    const reader=response.body?.getReader();if(!reader)throw new Error('content');
    const chunks=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();throw new Error('content');}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const text=new TextDecoder().decode(bytes);
    if(check.json){
      let body;try{body=JSON.parse(text);}catch{throw new Error('content');}
      if(body?.status!=='ok'||body?.services?.application!=='ok'||body?.services?.database!=='ok')throw new Error('degraded');
      const checked=Date.parse(body.checkedAt);const age=now()-checked;
      if(!Number.isFinite(checked)||age>120000||age< -30000)throw new Error('stale');
    }else if(!/<html[\s>]/i.test(text)||!/<\/html>/i.test(text)||!text.includes('Crestview'))throw new Error('content');
    const latencyMs=Math.round(clock()-start);
    return {...check,ok:latencyMs<=maxLatencyMs,status,latencyMs,reason:latencyMs>maxLatencyMs?'complete response exceeded latency target':''};
  }catch(error){
    const reasons={http:`HTTP ${status}`,content:'unexpected or incomplete response',degraded:'health response reported a degraded service',stale:'health response timestamp is missing or stale'};
    return {...check,ok:false,status,latencyMs:Math.round(clock()-start),reason:Object.hasOwn(reasons,error?.message??'')?reasons[error.message]:'request failed or timed out'};
  }
}
