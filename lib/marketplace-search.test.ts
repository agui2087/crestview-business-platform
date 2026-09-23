import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesLocation,parseAmount,searchListings} from './marketplace-search.ts';
const base={title:'Roofing contractor',summary:'Residential repair',industry:'Services',city:'Portland',state_code:'OR',asking_price:500000,annual_revenue:1000000,cash_flow:150000,financing_available:true,public_highlights:[],updated_at:'2026-09-01'};
const fixtures=[{...base,id:'a'},{...base,id:'b',city:'Seattle',state_code:'WA',asking_price:900000,financing_available:false},{...base,id:'c',asking_price:null,annual_revenue:null,cash_flow:null}];
test('locations match exact cities, full states and abbreviations without substrings',()=>{
 for(const value of ['Portland','Portland, OR','Portland, Oregon','oregon','OR']) assert.equal(matchesLocation('Portland','OR',value),true);
 assert.equal(matchesLocation('New York','NY','York'),false);
 assert.equal(matchesLocation('Portland','ME','Portland, OR'),false);
 assert.equal(matchesLocation('Charleston','WV','Virginia'),false);
});
test('amount parsing rejects malformed, negative and nonfinite values and preserves zero',()=>{
 for(const v of ['abc','-1','1e8','Infinity','1,23','2.999']) assert.equal(parseAmount(v),undefined);
 assert.equal(parseAmount(''),null);assert.equal(parseAmount('0'),0);assert.equal(parseAmount('$500,000.50'),500000.5);
});
test('filters combine, boundaries include equal values and unknown amounts are excluded',()=>{
 assert.deepEqual(searchListings(fixtures,{q:'roofing repair',city:'Oregon',industry:'services',minPrice:'500000',maxPrice:'500000',minRevenue:'1000000',minCashFlow:'150000',financing:'yes'}).results.map(x=>x.id),['a']);
 assert.equal(searchListings(fixtures,{q:'roofing pizza'}).results.length,0);
 assert.equal(searchListings(fixtures,{maxPrice:'0'}).results.length,0);
 assert.equal(searchListings(fixtures,{maxPrice:'abc'}).errors.length,1);
 assert.deepEqual(searchListings(fixtures,{minPrice:'900',maxPrice:'100'}).errors,['range']);
});
test('sorting puts undisclosed values last without mutating source or default placement',()=>{
 assert.deepEqual(searchListings(fixtures,{sort:'price-high'}).results.map(x=>x.id),['b','a','c']);
 assert.deepEqual(searchListings(fixtures,{sort:'price-low'}).results.map(x=>x.id),['a','b','c']);
 assert.deepEqual(searchListings(fixtures,{}).results.map(x=>x.id),['a','b','c']);
 assert.equal(searchListings(fixtures,{city:['Portland','Seattle']}).results.length,3);
});
