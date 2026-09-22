import { test } from "node:test";
import assert from "node:assert/strict";
import { buyerProfileSchema } from "./buyer-profile.ts";

const fields = { industries: "Roofing, Roofing", locations: "Oregon", minimum_price: "", maximum_price: "250000", minimum_cash_flow: "", desired_owner_income: "", available_cash: "0", buyer_injection_percent: "15", illustrative_interest_rate: "0", owner_involvement: "flexible", experience_level: "first_time", acquisition_timeline: "exploring", funding_status: "exploring", credit_readiness: "not_provided", risk_tolerance: "balanced", buyer_summary: "", seller_financing_preferred: false, proof_of_funds_status: "not_provided", share_summary: "private", share_experience: "private", share_financial: "private" };
test("buyer profile preserves explicit budget, zero cash, zero rate and private choices", () => {
  const result = buyerProfileSchema.parse(fields);
  assert.equal(result.maximum_price, 250000);
  assert.equal(result.available_cash, 0);
  assert.equal(result.illustrative_interest_rate, 0);
  assert.equal(result.share_financial, "private");
  assert.deepEqual(result.industries, ["Roofing"]);
});
test("buyer profile rejects invalid amounts, reversed budgets and self-verification", () => {
  for (const amount of ["-1", "NaN", "Infinity", "abc", "1.234", "1e6"]) assert.equal(buyerProfileSchema.safeParse({ ...fields, available_cash: amount }).success, false);
  assert.equal(buyerProfileSchema.safeParse({ ...fields, minimum_price: "300000" }).success, false);
  assert.equal(buyerProfileSchema.safeParse({ ...fields, proof_of_funds_status: "verified" }).success, false);
  assert.equal(buyerProfileSchema.safeParse({ ...fields, share_financial: "public" }).success, false);
});
test("buyer profile accepts absent finances and formatted amounts without inventing readiness", () => {
  const result = buyerProfileSchema.parse({ ...fields, available_cash: "", maximum_price: "$250,000.50" });
  assert.equal(result.available_cash, null);
  assert.equal(result.maximum_price, 250000.5);
  assert.equal(result.funding_status, "exploring");
});
