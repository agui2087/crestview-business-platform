import assert from "node:assert/strict";
import test from "node:test";
import { redactForLogs, reportOperationalEvent } from "./observability.ts";

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

test("error reporting sends only redacted operational fields", async () => {
  let sent = "";
  await reportOperationalEvent(
    {
      event: "document.upload_failed",
      level: "error",
      route: "/api/documents",
      message: "user person@example.com token=private-value failed",
      error: new Error("do-not-send-the-storage-object-name.pdf"),
      details: { email: "person@example.com", status: "failed" },
    },
    {
      webhookUrl: "https://alerts.example.test/crestview",
      webhookToken: "test-token",
      fetchImpl: async (_input, init) => {
        sent = String(init?.body ?? "");
        assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-token");
        return new Response(null, { status: 204 });
      },
    },
  );
  assert.equal(JSON.parse(sent).details.email, "[redacted]");
  assert.equal(JSON.parse(sent).details.status, "failed");
  assert.equal(JSON.parse(sent).message, "user [redacted-email] token [redacted] failed");
  assert.equal(JSON.parse(sent).error.message, undefined);
});
