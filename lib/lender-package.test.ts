import test from 'node:test';
import assert from 'node:assert/strict';
import { lenderPackageText } from './lender-package.ts';
test('lender package exports actual inventory, localizes labels and never invents zero funding',()=>{
  const input={locale:'es',title:'Negocio',location:'WA',industry:'Servicios',askingPrice:'$100',revenue:'$80',cashFlow:'$20',missing:[],records:['Financial statements']};
  const text=lenderPackageText(input);
  assert.ok(text.includes('Financial statements'));assert.ok(text.includes('No indicado'));assert.ok(text.includes('no se adjuntan'));
  assert.ok(lenderPackageText({...input,locale:'en',records:[]}).includes('No accessible linked documents'));
});
