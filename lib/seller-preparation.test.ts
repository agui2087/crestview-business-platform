import { test } from "node:test";
import assert from "node:assert/strict";
import { sellerPreparationSchema, sellerPreparationSteps } from "./seller-preparation.ts";
test("seller preparation accepts partial and reopened plans without claiming verification",()=>{
 const listing_id="00000000-0000-4000-8000-000000000001";
 for(const completed_steps of [[],["authority"],["authority","periods"]]) assert.equal(sellerPreparationSchema.safeParse({listing_id,completed_steps}).success,true);
 assert.equal(sellerPreparationSchema.safeParse({listing_id,completed_steps:["verified_financials"]}).success,false);
 assert.equal(new Set(sellerPreparationSteps.map(item=>item.id)).size,8);
});
