import { test } from "node:test";
import assert from "node:assert/strict";
import { accountProfileSchema } from "./account-profile.ts";

test("account profile allows a first-time buyer without a business or phone", () => {
  assert.deepEqual(accountProfileSchema.parse({ display_name: " New Buyer ", organization_name: "", job_title: " ", phone: "" }),
    { display_name: "New Buyer", organization_name: null, job_title: null, phone: null });
});
test("account profile limits text and does not accept role or verification changes", () => {
  const fields = { display_name: "Buyer", organization_name: "", job_title: "", phone: "" };
  assert.equal(accountProfileSchema.safeParse({ ...fields, phone: "x".repeat(51) }).success, false);
  assert.equal(accountProfileSchema.safeParse({ ...fields, display_name: "x".repeat(101) }).success, false);
  assert.deepEqual(accountProfileSchema.parse({ ...fields, verification_status: "verified", account_roles: ["broker"] }),
    { display_name: "Buyer", organization_name: null, job_title: null, phone: null });
});
