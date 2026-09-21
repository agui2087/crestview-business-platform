import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';

export type SigningSeal={format:'crestview-evidence-seal-v1';algorithm:'Ed25519';keyFingerprint:string;payload:string;signature:string};
export function signingKeyFingerprint(publicKey:string) {
 const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 key required');
 return createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
}
/** Seal the exact exported bytes, not a reserialized interpretation of JSON.
 * This authenticates a Crestview export, not a CA-certified signer identity.
 */
export function sealSigningEvidence(evidence:unknown,privateKey:string):SigningSeal {
 const key=createPrivateKey(privateKey);if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 key required');
 const publicKey=createPublicKey(key).export({type:'spki',format:'pem'}).toString();
 const bytes=Buffer.from(JSON.stringify(evidence));if(bytes.length>2_000_000)throw Error('Evidence too large');
 return {format:'crestview-evidence-seal-v1',algorithm:'Ed25519',keyFingerprint:signingKeyFingerprint(publicKey),payload:bytes.toString('base64'),signature:sign(null,bytes,key).toString('base64')};
}
export function verifySigningSeal(seal:SigningSeal,trustedPublicKey:string):unknown {
 if(seal.format!=='crestview-evidence-seal-v1'||seal.algorithm!=='Ed25519'||seal.keyFingerprint!==signingKeyFingerprint(trustedPublicKey)||typeof seal.payload!=='string'||seal.payload.length>2_700_000||typeof seal.signature!=='string'||seal.signature.length!==88)throw Error('Invalid seal');
 const bytes=Buffer.from(seal.payload,'base64'),signature=Buffer.from(seal.signature,'base64');
 if(bytes.toString('base64')!==seal.payload||signature.toString('base64')!==seal.signature||!verify(null,bytes,createPublicKey(trustedPublicKey),signature))throw Error('Seal verification failed');
 return JSON.parse(bytes.toString('utf8'));
}
