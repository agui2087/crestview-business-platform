import { test } from "node:test";
import assert from "node:assert/strict";
import { runFinancialAccessChange } from "./financial-access-result.ts";

test("only an explicit successful RPC result permits success", async () => {
  assert.deepEqual(await runFinancialAccessChange(async () => ({ error: null })), { ok: true });
});
test("resolved database errors never masquerade as success", async () => {
  for (const [code, reason] of [["40001", "conflict"], ["42501", "forbidden"], ["22023", "invalid"], ["PGRST202", "unavailable"], ["23514", "unavailable"]]) {
    assert.deepEqual(await runFinancialAccessChange(async () => ({ error: { code } })), { ok: false, reason });
  }
});
test("transport failure never reports success or retries a possibly committed write", async () => {
  let calls = 0;
  const result = await runFinancialAccessChange(async () => { calls++; throw new Error("Connection lost"); });
  assert.deepEqual(result, { ok: false, reason: "unavailable" });
  assert.equal(calls, 1);
});
