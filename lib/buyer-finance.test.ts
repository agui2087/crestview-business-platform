import assert from "node:assert/strict";
import test from "node:test";
import { estimateBuyerRange, financialFitForDeal, savedBuyerFinanceInputs } from "./buyer-finance.ts";

test("estimateBuyerRange includes injection and working capital reserve", () => {
  const result = estimateBuyerRange({ availableCash: 100000, desiredOwnerIncome: 90000, injectionPercent: 15, interestRate: 11 });
  assert.equal(Math.round(result.maxPurchasePrice), 500000);
  assert.ok(result.suggestedMinimumCashFlow > 170000);
});

test("financialFitForDeal separates cash need from debt coverage", () => {
  const result = financialFitForDeal(500000, 200000, { availableCash: 100000, desiredOwnerIncome: 90000, injectionPercent: 15, interestRate: 11 });
  assert.equal(result.score, 100);
  assert.equal(result.status, "strong");
});

test("financialFitForDeal stays unknown without saved private assumptions", () => {
  const result = financialFitForDeal(500000, 200000, null);
  assert.equal(result.score, null);
  assert.equal(result.status, "unknown");
});

test('explicit zero cash remains a saved assumption rather than being treated as missing',()=>{
 const inputs=savedBuyerFinanceInputs({available_cash:0,buyer_injection_percent:15,illustrative_interest_rate:11},0);
 assert.equal(inputs?.availableCash,0);
 const estimate=financialFitForDeal(500000,10000,inputs);
 assert.notEqual(estimate.score,null);
 assert.ok(estimate.reasons.some(reason=>reason.includes('exceeds your saved amount')));
 assert.equal(savedBuyerFinanceInputs(null,0),null);
 assert.equal(savedBuyerFinanceInputs({available_cash:null,buyer_injection_percent:15,illustrative_interest_rate:11},0),null);
});
test('missing asking price is distinguished from missing buyer assumptions',()=>{
 const inputs={availableCash:0,desiredOwnerIncome:0,injectionPercent:15,interestRate:11};
 for(const price of [null,0,-1,NaN]){
  const result=financialFitForDeal(price,10000,inputs);
  assert.equal(result.score,null);assert.match(result.reasons[0],/asking price/);
 }
});
