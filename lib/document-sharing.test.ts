import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buyerCanReadDocument,suggestedDocumentTitle,secureExternalLink} from './document-sharing.ts';
test('sharing preview stays private until the selected conditions are met',()=>{
  for(const nda of [false,true])for(const approved of [false,true])assert.equal(buyerCanReadDocument('broker_only',nda,approved),false);
  assert.equal(buyerCanReadDocument('approved',true,false),false);
  assert.equal(buyerCanReadDocument('approved',true,true),true);
  assert.equal(buyerCanReadDocument('nda_signed',false,true),false);
  assert.equal(buyerCanReadDocument('nda_signed',true,false),true);
});
test('upload titles are editable suggestions and external links require HTTPS without credentials',()=>{
  assert.equal(suggestedDocumentTitle('2025_P-and-L.pdf'),'2025 P and L');
  for(const url of ['javascript:alert(1)','http://example.com','https://user:password@example.com','broken'])assert.equal(secureExternalLink(url),false);
  assert.equal(secureExternalLink('https://example.com/document'),true);
});
