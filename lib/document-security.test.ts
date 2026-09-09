import test from "node:test";
import assert from "node:assert/strict";
import { hasValidDocumentSignature, inspectDocumentSafety } from "./document-security.ts";

test("accepts supported files with matching signatures", () => {
  assert.equal(hasValidDocumentSignature("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), true);
  assert.equal(hasValidDocumentSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasValidDocumentSignature("text/csv", new TextEncoder().encode("year,revenue\n2026,100000")), true);
});

test("blocks antivirus test payloads and active PDF content", async () => {
  const eicar = new File(["EICAR-STANDARD-ANTIVIRUS-TEST-FILE"], "test.txt", { type: "text/plain" });
  assert.equal((await inspectDocumentSafety(eicar)).safe, false);
  const activePdf = new File(["%PDF-1.7 /JavaScript"], "active.pdf", { type: "application/pdf" });
  assert.equal((await inspectDocumentSafety(activePdf)).safe, false);
  const normalPdf = new File(["%PDF-1.7 ordinary content"], "normal.pdf", { type: "application/pdf" });
  assert.equal((await inspectDocumentSafety(normalPdf)).safe, true);
});

test("rejects renamed or binary files whose contents do not match", () => {
  assert.equal(hasValidDocumentSignature("application/pdf", new TextEncoder().encode("not a pdf")), false);
  assert.equal(hasValidDocumentSignature("text/plain", new Uint8Array([0x41, 0, 0x42])), false);
  assert.equal(hasValidDocumentSignature("application/octet-stream", new Uint8Array([1, 2, 3])), false);
});
