import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifySigningDelivery} from './signing-delivery.ts';
const key=Buffer.alloc(32,7),secret=`whsec_${key.toString('base64')}`;
function signed(body:string,offset=0){const stamp=String(Math.floor(Date.now()/1000)+offset),id='msg_synthetic';return new Headers({'svix-id':id,'svix-timestamp':stamp,'svix-signature':`v1,${createHmac('sha256',key).update(`${id}.${stamp}.${body}`).digest('base64')}`});}
test('delivery confirmations require valid signatures, fresh timestamps and exact raw bytes',()=>{
 const body=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'00000000-0000-4000-8000-000000000001'}});
 assert.equal(verifySigningDelivery(body,signed(body),secret).state,'delivered');
 assert.throws(()=>verifySigningDelivery(body+' ',signed(body),secret));
 assert.throws(()=>verifySigningDelivery(body,signed(body,-601),secret));
 assert.throws(()=>verifySigningDelivery(body,signed(body,601),secret));
 assert.throws(()=>verifySigningDelivery(body,new Headers(),secret));
 assert.throws(()=>verifySigningDelivery('x'.repeat(65537),new Headers(),secret));
 for(const type of ['email.bounced','email.complained','email.failed','email.suppressed']){const b=body.replace('email.delivered',type);assert.equal(verifySigningDelivery(b,signed(b),secret).state,'failed');}
 const ignored=body.replace('email.delivered','email.opened');assert.equal(verifySigningDelivery(ignored,signed(ignored),secret).state,null);
});
