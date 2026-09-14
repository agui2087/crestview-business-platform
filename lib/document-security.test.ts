import test from "node:test";
import assert from "node:assert/strict";
import { maxVaultDocumentBytes, maxDealRoomDocumentBytes, hasValidDocumentSignature, inspectDocumentSafety, scanUploadedDocument, securityStatusForScan } from "./document-security.ts";

test('free scanner limits are enforced without sending oversized documents',async()=>{
 assert.equal(maxVaultDocumentBytes,3_500_000);
 assert.equal(maxDealRoomDocumentBytes,3_500_000);
 let called=false;
 const result=await scanUploadedDocument(new File([new Uint8Array(3_500_001)],'synthetic.txt',{type:'text/plain'}),{apiKey:'test',fetchImpl:async()=>{called=true;throw Error('must not send');}});
 assert.equal(called,false);assert.equal(result.status,'blocked');assert.match(result.reason!,/3.5 MB/);
});

test('quota rejection never falls back to an unscanned upload',async()=>{
 const result=await scanUploadedDocument(new File(['synthetic'],'synthetic.txt',{type:'text/plain'}),{apiKey:'test',fetchImpl:async()=>new Response('',{status:429})});
 assert.equal(result.status,'unavailable');assert.equal(securityStatusForScan(result),'quarantined');assert.match(result.reason!,/usage limit/);
});

test("accepts supported files with matching signatures", () => {
  assert.equal(hasValidDocumentSignature("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), true);
  assert.equal(hasValidDocumentSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasValidDocumentSignature("text/csv", new TextEncoder().encode("year,revenue\n2026,100000")), true);
});

test("managed scanning fails closed and records clean results", async () => {
  const file = new File(["%PDF-1.7 ordinary content"], "safe.pdf", { type: "application/pdf" });
  const clean = await scanUploadedDocument(file, { apiKey: "test", fetchImpl: async (_url,options) => {assert.equal(options?.redirect,'error');return new Response(JSON.stringify({ CleanResult: true }), { status: 200 });} });
  assert.equal(clean.status, "clean");
  assert.equal(securityStatusForScan(clean), "malware_scanned");
  const unavailable = await scanUploadedDocument(file, { apiKey: "test", fetchImpl: async () => new Response("failure", { status: 503 }) });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(securityStatusForScan(unavailable), "quarantined");
  const blocked = await scanUploadedDocument(file, { apiKey: "test", fetchImpl: async () => new Response(JSON.stringify({ CleanResult: false }), { status: 200 }) });
  assert.equal(blocked.status, "blocked");
  assert.equal(securityStatusForScan(blocked), "blocked");
});

test('scanner transport failures keep the file quarantined without exposing provider details',async()=>{
 const result=await scanUploadedDocument(new File(['%PDF-1.7 synthetic'],'synthetic.pdf',{type:'application/pdf'}),{apiKey:'synthetic',fetchImpl:async()=>{throw new Error('redirect with private provider details');}});
 assert.equal(result.status,'unavailable');assert.equal(securityStatusForScan(result),'quarantined');
 assert.ok(!result.reason?.includes('private provider details'));
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
