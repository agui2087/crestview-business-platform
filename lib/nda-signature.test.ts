import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSignatureAppearance} from './nda-signature.ts';
test('signature appearances reject empty, invisible, malformed and excessive data',()=>{
 assert.deepEqual(parseSignatureAppearance({mode:'typed'}),{mode:'typed'});
 assert.equal(parseSignatureAppearance({mode:'drawn',strokes:[[[.1,.1],[.4,.6]]]}).mode,'drawn');
 for(const v of [{mode:'typed',image:'extra'},{mode:'drawn',strokes:[]},{mode:'drawn',strokes:[[[.1,.1],[.1,.1]]]},{mode:'drawn',strokes:[[[0,0],[2,1]]]},{mode:'uploaded',image:'data:image/svg+xml;base64,AAAA'},{mode:'uploaded',image:'https://remote/image.png'}])assert.throws(()=>parseSignatureAppearance(v));
 assert.throws(()=>parseSignatureAppearance({mode:'drawn',strokes:Array.from({length:7},()=>Array.from({length:500},(_,i)=>[i/500,i/500]))}));
});
