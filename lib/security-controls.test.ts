import assert from "node:assert/strict";
import test from "node:test";
import { AI_ANALYSIS_MAX_FACT_BYTES, isAiAnalysisEnabled, isAiAnalysisPayloadAllowed } from "./ai-security.ts";
import { isLocalAuthenticationAllowed } from "./auth-environment.ts";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "./security-headers.ts";

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

test("browser security policy is enforced with restrictive defaults", () => {
  const headerNames = new Set(SECURITY_HEADERS.map((header) => header.key.toLowerCase()));

  assert.equal(headerNames.has("content-security-policy"), true);
  assert.equal(headerNames.has("content-security-policy-report-only"), false);
  assert.equal(headerNames.has("strict-transport-security"), true);
  assert.match(CONTENT_SECURITY_POLICY, /default-src 'self'/);
  assert.match(CONTENT_SECURITY_POLICY, /object-src 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /upgrade-insecure-requests/);
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /unsafe-eval/);
});
