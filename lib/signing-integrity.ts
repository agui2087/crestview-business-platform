import {createHash} from 'node:crypto';
export function matchesRecordedPdf(bytes:Uint8Array,expected:unknown) {
 return typeof expected==='string'&&/^[a-f0-9]{64}$/.test(expected)&&createHash('sha256').update(bytes).digest('hex')===expected;
}
