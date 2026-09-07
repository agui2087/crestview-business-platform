import assert from "node:assert/strict";
import test from "node:test";
import { redactForLogs } from "./observability.ts";

test("operational logging redacts sensitive fields recursively", () => {
  assert.deepEqual(
    redactForLogs({
      eventId: "evt_123",
      authorization: "Bearer private",
      nested: { email: "person@example.com", status: "failed" },
    }),
    {
      eventId: "evt_123",
      authorization: "[redacted]",
      nested: { email: "[redacted]", status: "failed" },
    },
  );
});

test("operational logging truncates excessive content", () => {
  const result = redactForLogs({ note: "x".repeat(700) }) as { note: string };
  assert.equal(result.note.length, 501);
  assert.ok(result.note.endsWith("…"));
});
