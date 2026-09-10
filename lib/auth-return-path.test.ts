import test from "node:test";
import assert from "node:assert/strict";
import {authReturnPath} from "./auth-return-path.ts";
test("sign-in resumes a safe localized workspace without open redirects",()=>{
  assert.equal(authReturnPath("/en/dashboard/deals/123?view=documents#deal-documents","en"),"/en/dashboard/deals/123?view=documents#deal-documents");
  for(const value of [undefined,"https://evil.invalid","//evil.invalid","/en/../../api/local-auth/signout","/en/\\evil.invalid","/en/%2f%2fevil.invalid","/en/sign-in","/en/create-account","/es/dashboard","/api/documents"])
    assert.equal(authReturnPath(value,"en"),"/en/dashboard");
  assert.equal(authReturnPath("/es/dashboard/inbox","es"),"/es/dashboard/inbox");
});
