import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ndaFieldsSchema,parseNdaLayout,valuesForFields,type NdaField} from './nda-fields.ts';
const f:NdaField={id:'00000000-0000-4000-8000-000000000001',type:'signature',page:1,x:.1,y:.1,width:.4,height:.05};
test('visual fields reject missing signatures, overlaps, duplicate IDs, invalid geometry and pages',()=>{
 assert.equal(ndaFieldsSchema.safeParse([f]).success,true);
 for(const fs of [[],[{...f,type:'date'}],[f,f],[{...f,x:.9}],[{...f,page:0}],[{...f,width:Infinity}],[{...f,height:.001}]])assert.equal(ndaFieldsSchema.safeParse(fs).success,false);
 assert.throws(()=>parseNdaLayout({fields:[{...f,page:2}],sha256:'a'.repeat(64),pages:1,revision:f.id}));
});
test('every field must be acknowledged; date is generated from server time',()=>{
 const fields=[f,{...f,id:'00000000-0000-4000-8000-000000000002',type:'date' as const,y:.2}];
 assert.throws(()=>valuesForFields(fields,'Test Buyer','',[],new Date()));
 const values=valuesForFields(fields,' Test Buyer ','',fields.map(v=>v.id),new Date('2026-09-19T23:59:59Z'));
 assert.deepEqual(Object.values(values),['Test Buyer','2026-09-19']);
 assert.throws(()=>valuesForFields(fields,'Bad\nname','',fields.map(v=>v.id),new Date()));
});
