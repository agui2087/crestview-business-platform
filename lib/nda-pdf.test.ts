import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,degrees,StandardFonts} from 'pdf-lib';
import {completeSigningPdf,pdfHash,pdfPoint,inspectSigningPdf} from './nda-pdf.ts';
import type {NdaLayout} from './nda-fields.ts';
test('PDF completion preserves originals and supports cropped/rotated pages',async()=>{
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);
 for(const rotation of [0,90,180,270]){const p=doc.addPage([612,792]);p.setCropBox(20,30,550,700);p.setRotation(degrees(rotation));p.drawText('SYNTHETIC AGREEMENT',{x:60,y:650,size:16,font});}
 const bytes=await doc.save(),hash=pdfHash(bytes);
 const fields=[0,1,2,3].map((n)=>({id:`00000000-0000-4000-8000-00000000000${n+1}`,type:'signature' as const,page:n+1,x:.1,y:.7,width:.4,height:.05}));
 const layout:NdaLayout={fields,pages:4,sha256:hash,revision:fields[0].id};
 const output=await completeSigningPdf(bytes,layout,Object.fromEntries(fields.map(f=>[f.id,'Synthetic Buyer'])));
 assert.equal(pdfHash(bytes),hash);assert.notEqual(pdfHash(output),hash);assert.equal((await PDFDocument.load(output)).getPageCount(),4);
 await assert.rejects(completeSigningPdf(bytes,{...layout,sha256:'a'.repeat(64)},{}));
 await assert.rejects(completeSigningPdf(bytes,layout,{}));
 const b={x:20,y:30,width:550,height:700};
 assert.deepEqual(pdfPoint(10,20,b,0),{x:30,y:710});assert.deepEqual(pdfPoint(10,20,b,90),{x:40,y:40});assert.deepEqual(pdfPoint(10,20,b,180),{x:560,y:50});assert.deepEqual(pdfPoint(10,20,b,270),{x:550,y:720});
});
test('interactive forms are not silently modified',async()=>{
 const doc=await PDFDocument.create();const page=doc.addPage();doc.getForm().createTextField('existing').addToPage(page);
 await assert.rejects(inspectSigningPdf(await doc.save()),/flat, unsigned PDF/);
});
