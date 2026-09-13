import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePrivatePage,PRIVATE_JOB_BUDGET_MS,PRIVATE_MODEL_ATTEMPT_MS} from './private-model-client.ts';
import {PRIVATE_MODEL_ENDPOINT} from './private-analysis.ts';
const finding={metric:'Revenue',reportedValue:'$100',period:'2025',page:1,evidence:'Revenue $100 in 2025',uncertainty:''};
const input={model:'qwen3:4b',page:1,language:'en',text:'Revenue $100 in 2025',deadline:10000};
const response=(value:unknown)=>new Response(JSON.stringify({message:{content:JSON.stringify(value)}}));
test('private model stays on loopback, refuses redirects and validates its first result',async()=>{
  let calls=0;
  const result=await analyzePrivatePage(input,{now:()=>0,fetch:async(url,options)=>{
    calls++;assert.equal(url,PRIVATE_MODEL_ENDPOINT);assert.equal(options?.redirect,'error');assert.ok(options?.signal);
    const body=JSON.parse(String(options?.body));assert.equal(body.messages.length,2);assert.equal(body.stream,false);
    return response({findings:[finding]});
  }});
  assert.deepEqual(result,[finding]);assert.equal(calls,1);
  assert.ok(PRIVATE_JOB_BUDGET_MS<40*60*1000);assert.equal(PRIVATE_MODEL_ATTEMPT_MS,180000);
});
test('one correction can repair an unsupported result without weakening citations',async()=>{
  let calls=0;
  const result=await analyzePrivatePage(input,{now:()=>0,fetch:async(_url,options)=>{
    calls++;const body=JSON.parse(String(options?.body));
    if(calls===1)return response({findings:[{...finding,period:'025'}]});
    assert.equal(body.messages.length,4);assert.equal(body.messages[2].role,'assistant');
    assert.match(body.messages[3].content,/source validation/);
    return response({findings:[finding]});
  }});
  assert.deepEqual(result,[finding]);assert.equal(calls,2);
});
test('persistent invalid output stops after two attempts',async()=>{
  let calls=0;
  await assert.rejects(analyzePrivatePage(input,{now:()=>0,fetch:async()=>{calls++;return response({findings:[{...finding,reportedValue:'$999'}]});}}),/invalid_result/);
  assert.equal(calls,2);
});
test('network failure is not retried or exposed',async()=>{
  let calls=0;
  await assert.rejects(analyzePrivatePage(input,{now:()=>0,fetch:async()=>{calls++;throw new Error('private source details');}}),/^Error: model_unavailable$/);
  assert.equal(calls,1);
});
test('expired job makes no request and late result cannot be accepted',async()=>{
  await assert.rejects(analyzePrivatePage(input,{now:()=>10000,fetch:async()=>{assert.fail('expired request');}}),/worker_unavailable/);
  let clock=0;
  await assert.rejects(analyzePrivatePage(input,{now:()=>clock,fetch:async()=>{clock=10000;return response({findings:[finding]});}}),/worker_unavailable/);
});
test('malformed envelope is rejected and empty legitimate extraction is accepted',async()=>{
  await assert.rejects(analyzePrivatePage(input,{now:()=>0,fetch:async()=>new Response('{}')}),/invalid_result/);
  assert.deepEqual(await analyzePrivatePage(input,{now:()=>0,fetch:async()=>response({findings:[]})}),[]);
});
