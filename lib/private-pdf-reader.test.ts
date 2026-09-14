import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractPrivatePdf,parsePrivatePdfOutput} from './private-pdf-reader.ts';

test('reader process failures never blame the document or expose diagnostics',()=>{
 for(const error of [{killed:true},new Error('private document text'),{code:'ENOENT'},{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'}])assert.throws(()=>parsePrivatePdfOutput(error,'private source'),/^Error: worker_unavailable$/);
 for(const value of ['not json','null','{}','{"pages":[1]}','{"pages":[""]}','{"error":"secret"}'])assert.throws(()=>parsePrivatePdfOutput(null,value),/^Error: worker_unavailable$/);
});
test('explicit PDF validation failures retain safe categories',()=>{
 for(const error of ['unreadable_pdf','page_limit','page_too_large','ocr_required'])assert.throws(()=>parsePrivatePdfOutput(null,JSON.stringify({error})),new RegExp(`^Error: ${error}$`));
 assert.deepEqual(parsePrivatePdfOutput(null,'{"pages":["Synthetic source"]}'),['Synthetic source']);
});
test('bounded reader extracts the actual fixture and rejects invalid PDF bytes',async()=>{
 const bytes=await readFile(new URL('../e2e/fixtures/synthetic.pdf',import.meta.url));
 assert.match((await extractPrivatePdf(bytes))[0],/SYNTHETIC TEST ONLY/);
 await assert.rejects(extractPrivatePdf(Buffer.from('not a PDF')),/^Error: unreadable_pdf$/);
});
