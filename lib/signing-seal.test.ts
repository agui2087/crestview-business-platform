import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {sealSigningEvidence,verifySigningSeal} from './signing-seal.ts';
test('portable evidence seal rejects tampering and untrusted replacement keys',()=>{
 const pair=generateKeyPairSync('ed25519'),privateKey=pair.privateKey.export({format:'pem',type:'pkcs8'}).toString(),publicKey=pair.publicKey.export({format:'pem',type:'spki'}).toString();
 const evidence={agreement:'synthetic',original_sha256:'a'.repeat(64),completed_sha256:'b'.repeat(64)},seal=sealSigningEvidence(evidence,privateKey);
 assert.deepEqual(verifySigningSeal(seal,publicKey),evidence);
 assert.throws(()=>verifySigningSeal({...seal,payload:Buffer.from(JSON.stringify({...evidence,agreement:'changed'})).toString('base64')},publicKey));
 assert.throws(()=>verifySigningSeal({...seal,signature:'A'.repeat(88)},publicKey));
 const other=generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'}).toString();
 assert.throws(()=>verifySigningSeal(seal,other));
 assert.throws(()=>verifySigningSeal({...seal,payload:seal.payload+'\n'},publicKey));
});
