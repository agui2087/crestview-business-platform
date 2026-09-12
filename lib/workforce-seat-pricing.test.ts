import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkforceSeats,WORKFORCE_SEAT_USD} from './workforce-seat-pricing.ts';
test('exact Workforce seats include small teams and non-tier counts',()=>{
  for(const n of [1,4,5,11,25,301,1000,99999]) {assert.equal(parseWorkforceSeats(String(n)),n);assert.equal(parseWorkforceSeats(n),n);}
  assert.equal(parseWorkforceSeats('4')*WORKFORCE_SEAT_USD,8);
  assert.equal(parseWorkforceSeats('5')*WORKFORCE_SEAT_USD,10);
});
test('invalid seat quantities never enter checkout',()=>{
  for(const v of ['',null,undefined,true,[],0,-1,1.5,'1e2','2.5','Infinity',100000,NaN])assert.throws(()=>parseWorkforceSeats(v));
});
