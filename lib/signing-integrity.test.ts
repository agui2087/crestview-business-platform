import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {matchesRecordedPdf} from './signing-integrity.ts';
test('signed original verification rejects modified bytes and missing historical hashes',()=>{
 const original=Buffer.from('%PDF-1.4 synthetic original');const hash=createHash('sha256').update(original).digest('hex');
 assert.equal(matchesRecordedPdf(original,hash),true);
 assert.equal(matchesRecordedPdf(Buffer.from('%PDF-1.4 modified'),hash),false);
 for(const invalid of [null,undefined,'','bad','A'.repeat(64)])assert.equal(matchesRecordedPdf(original,invalid),false);
});
