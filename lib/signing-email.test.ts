import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signingEmailContent,sendSigningEmail,emailRetryAt,type SigningEmail} from './signing-email.ts';
const m:SigningEmail={id:'00000000-0000-4000-8000-000000000001',recipient:'synthetic@example.com',inquiryId:'00000000-0000-4000-8000-000000000002',locale:'en',kind:'invitation'};
const config={apiKey:'synthetic-only',from:'signing@example.com',origin:'https://example.com'};
test('signing emails contain only authenticated workspace links and localized neutral copy',()=>{
 for(const locale of ['en','es'] as const)for(const kind of ['invitation','reminder','completed'] as const){
  const c=signingEmailContent({...m,locale,kind},config.origin);
  assert.ok(c.text.includes(`https://example.com/${locale}/dashboard/deals/${m.inquiryId}`));
  assert.ok(!c.text.includes(m.recipient));assert.ok(!c.text.includes('token='));
 }
 for(const origin of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com?next=evil'])assert.throws(()=>signingEmailContent(m,origin));
 assert.throws(()=>signingEmailContent({...m,recipient:'bad\r\nBcc: other@example.com'},config.origin));
});
test('provider submission uses stable idempotency and does not claim delivery',async()=>{
 const fake:typeof fetch=async(input,init)=>{assert.equal(input,'https://api.resend.com/emails');assert.equal(new Headers(init?.headers).get('Idempotency-Key'),`signing/${m.id}`);assert.equal(init?.redirect,'error');return Response.json({id:m.id});};
 assert.deepEqual(await sendSigningEmail(m,config,fake),{state:'sent',providerId:m.id});
});
test('provider failures are classified without leaking response content',async()=>{
 for(const status of [400,401,403,422,429,500,503]){
  const result=await sendSigningEmail(m,config,async()=>new Response('private provider detail',{status}));
  assert.deepEqual(result,{state:status===429||status>=500?'retry':'failed',code:`provider_${status}`});
 }
 assert.deepEqual(await sendSigningEmail(m,config,async()=>{throw Error('secret');}),{state:'retry',code:'connection'});
 assert.deepEqual(await sendSigningEmail(m,config,async()=>Response.json({})),{state:'retry',code:'invalid_response'});
 assert.deepEqual(await sendSigningEmail(m,{...config,apiKey:''},async()=>{throw Error('must not send');}),{state:'failed',code:'configuration'});
});
test('retry budget is bounded and expires before provider deduplication expires',()=>{
 const now=Date.now();assert.equal(emailRetryAt(1,now,now),now+60_000);
 assert.equal(emailRetryAt(8,now,now),null);assert.equal(emailRetryAt(1,now-23*3_600_000,now),null);
 assert.equal(emailRetryAt(0,now,now),null);assert.equal(emailRetryAt(1,now+1,now),null);
});
