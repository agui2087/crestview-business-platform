import {readFile} from 'node:fs/promises';
import {verifySigningSeal} from '../lib/signing-seal.ts';
const [file,key]=process.argv.slice(2);
if(!file||!key)throw Error('Usage: verify-signing-seal.mts evidence-seal.json trusted-public-key.pem');
// The trusted key must be obtained separately; never trust a key bundled by an
// unknown sender alongside the document they want you to verify.
const raw=await readFile(file);if(raw.length>3_000_000)throw Error('Seal file too large');
verifySigningSeal(JSON.parse(raw.toString('utf8')),await readFile(key,'utf8'));
console.log('Crestview export seal verified against the supplied trusted key. This is not independent signer identity verification or legal validation.');
