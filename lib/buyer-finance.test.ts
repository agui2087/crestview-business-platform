import assert from "node:assert/strict";
import test from "node:test";
import { estimateBuyerRange, financialFitForDeal } from "./buyer-finance.ts";

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
