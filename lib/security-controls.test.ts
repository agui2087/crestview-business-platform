import assert from "node:assert/strict";
import test from "node:test";
import { AI_ANALYSIS_MAX_FACT_BYTES, isAiAnalysisEnabled, isAiAnalysisPayloadAllowed } from "./ai-security.ts";
import { isLocalAuthenticationAllowed } from "./auth-environment.ts";

test("AI analysis is fail-closed unless explicitly enabled", () => {
  assert.equal(isAiAnalysisEnabled({}), false);
  assert.equal(isAiAnalysisEnabled({ CRESTVIEW_AI_ANALYSIS_ENABLED: "true" }), true);
});

test("AI analysis rejects oversized source facts", () => {
  assert.equal(isAiAnalysisPayloadAllowed({ note: "safe" }), true);
  assert.equal(isAiAnalysisPayloadAllowed({ note: "x".repeat(AI_ANALYSIS_MAX_FACT_BYTES) }), false);
});

test("local authentication can never run in production", () => {
  assert.equal(isLocalAuthenticationAllowed({ NODE_ENV: "production", CRESTVIEW_ENABLE_LOCAL_AUTH: "true" }), false);
  assert.equal(isLocalAuthenticationAllowed({ NODE_ENV: "development", CRESTVIEW_ENABLE_LOCAL_AUTH: "true" }), true);
  assert.equal(isLocalAuthenticationAllowed({ NODE_ENV: "development" }), false);
});
