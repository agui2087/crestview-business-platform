import test from 'node:test';
import assert from 'node:assert/strict';
import {checkEndpoint} from '../scripts/monitor-endpoint.mjs';
const page={name:'Page',path:'/en',json:false};
const health={name:'Health',path:'/api/health',json:true};
const options={origin:'https://example.test',timeoutMs:1000,maxLatencyMs:2500};
const html=()=>new Response('<html><body>Crestview</body></html>',{headers:{'content-type':'text/html'}});
test('valid complete page succeeds and requests reject redirects',async()=>{
  const result=await checkEndpoint(page,{...options,fetchImpl:async(_url:unknown,init?:RequestInit)=>{assert.equal(init?.redirect,'error');return html();}});
  assert.equal(result.ok,true);
});
test('headers alone cannot hide slow response bodies',async()=>{
  let clock=0;
  const response=new Response(new ReadableStream({pull(controller){clock=3000;controller.enqueue(new TextEncoder().encode('<html>Crestview</html>'));controller.close();}}),{headers:{'content-type':'text/html'}});
  const result=await checkEndpoint(page,{...options,clock:()=>clock,fetchImpl:async()=>response});
  assert.equal(result.ok,false);assert.equal(result.latencyMs,3000);
});
test('empty, wrong-type, truncated and oversized pages fail safely',async()=>{
  for(const response of [new Response(''),new Response('oops',{headers:{'content-type':'text/html'}}),new Response('<html>Crestview',{headers:{'content-type':'text/html'}}),new Response('x'.repeat(2*1024*1024+1),{headers:{'content-type':'text/html'}})]){
    assert.equal((await checkEndpoint(page,{...options,fetchImpl:async()=>response})).ok,false);
  }
});
test('health requires fresh server timestamp and healthy services',async()=>{
  const now=Date.now();
  const body={status:'ok',services:{application:'ok',database:'ok'},checkedAt:new Date(now).toISOString()};
  const check=(value:unknown)=>checkEndpoint(health,{...options,now:()=>now,fetchImpl:async()=>Response.json(value)});
  assert.equal((await check(body)).ok,true);
  for(const changed of [{checkedAt:undefined},{checkedAt:new Date(now-121000).toISOString()},{checkedAt:new Date(now+31000).toISOString()},{services:{application:'ok',database:'unavailable'}}])assert.equal((await check({...body,...changed})).ok,false);
});
test('request errors never disclose raw URLs, tokens or messages',async()=>{
  const result=await checkEndpoint(page,{...options,fetchImpl:async()=>{throw new Error('secret-sentinel https://private.test?token=123');}});
  assert.equal(result.ok,false);assert.doesNotMatch(JSON.stringify(result),/sentinel|token/);
});
