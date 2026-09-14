import test from 'node:test';
import assert from 'node:assert/strict';
import {sendSentryEvent} from './sentry-events.ts';
const dsn='https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456';
test('Sentry sends only allowlisted categories and safe release metadata',async()=>{
  for(const event of ['document.upload_failed','private user@example.com document text']) {
    await sendSentryEvent(event,{dsn,release:'abcdef123',environment:'production',fetchImpl:async(input,init)=>{
      assert.equal(String(input),'https://o123.ingest.us.sentry.io/api/456/envelope/');
      assert.equal(init?.redirect,'error');
      const lines=String(init?.body).trim().split('\n');
      const payload=JSON.parse(lines[2]);
      assert.equal(payload.message,event.startsWith('document.') ? event : 'application.error');
      assert.deepEqual(Object.keys(payload).sort(),['environment','event_id','fingerprint','level','logger','message','platform','release','timestamp'].sort());
      assert.equal(JSON.parse(lines[1]).length,new TextEncoder().encode(lines[2]).length);
      assert.equal(String(init?.body).includes('user@example.com'),false);
      return new Response('{}');
    }});
  }
});
test('Sentry rejects unsafe destinations and fails safely on rejection',async()=>{
  for(const value of [dsn.replace('https:','http:'),dsn.replace('sentry.io','sentry.io.evil.test'),dsn+'?secret=1'])
    await assert.rejects(sendSentryEvent('x',{dsn:value,fetchImpl:async()=>{throw Error('must not fetch');}}),/Invalid Sentry/);
  await assert.rejects(sendSentryEvent('x',{dsn,fetchImpl:async()=>new Response(null,{status:429})}),/Sentry delivery failed/);
});
