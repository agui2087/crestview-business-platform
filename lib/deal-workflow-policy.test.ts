import assert from "node:assert/strict";
import test from "node:test";
import { allowedBrokerTransitions, canBrokerAdvanceDeal } from "./deal-workflow-policy.ts";

test("broker review can approve or decline a submitted buyer", () => {
  assert.equal(canBrokerAdvanceDeal("submitted", "screening"), true);
  assert.equal(canBrokerAdvanceDeal("submitted", "approved"), true);
  assert.equal(canBrokerAdvanceDeal("submitted", "declined"), true);
});

test("manual status changes cannot bypass NDA signature", () => {
  assert.equal(canBrokerAdvanceDeal("approved", "nda_signed"), false);
  assert.equal(canBrokerAdvanceDeal("nda_sent", "nda_signed"), false);
  assert.equal(canBrokerAdvanceDeal("nda_sent", "document_review"), false);
});

test("an offer can close only after the protected deal stages", () => {
  assert.equal(canBrokerAdvanceDeal("document_review", "offer"), true);
  assert.equal(canBrokerAdvanceDeal("offer", "closed"), true);
  assert.equal(canBrokerAdvanceDeal("submitted", "closed"), false);
});

test("unknown and closed stages have no manual transitions", () => {
  assert.deepEqual(allowedBrokerTransitions("unknown"), []);
  assert.deepEqual(allowedBrokerTransitions("closed"), []);
});
