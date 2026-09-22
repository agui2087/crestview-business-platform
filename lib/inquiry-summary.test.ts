import { test } from "node:test";
import assert from "node:assert/strict";
import { indexInquirySummaries } from "./inquiry-summary.ts";

test("buyer summary sharing remains scoped to each inquiry for the same buyer", () => {
  const records = [
    { inquiry: { id: "signed-deal", buyer_id: "same-buyer" }, result: { data: { available_cash: 100000 as number | null } } },
    { inquiry: { id: "unsigned-deal", buyer_id: "same-buyer" }, result: { data: { available_cash: null as number | null } } },
  ];
  for (const ordered of [records, [...records].reverse()]) {
    const summaries = indexInquirySummaries(ordered);
    assert.equal(summaries.get("signed-deal")?.available_cash, 100000);
    assert.equal(summaries.get("unsigned-deal")?.available_cash, null);
    assert.equal(summaries.has("same-buyer"), false);
  }
});
test("an unavailable summary never inherits another inquiry's data", () => {
  const summaries = indexInquirySummaries([{ inquiry: { id: "allowed" }, result: { data: "private summary" } }, { inquiry: { id: "denied" }, result: { data: null } }]);
  assert.equal(summaries.get("denied"), undefined);
});
