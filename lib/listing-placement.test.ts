import test from 'node:test';
import assert from 'node:assert/strict';
import {applyListingPlacement} from './listing-placement.ts';
test('sponsored ranking preserves facts, respects expiry and cannot add an irrelevant listing',()=>{
  const now=Date.parse('2026-09-01');
  const listings=[{id:'organic',quality_score:99,updated_at:'2026-08-30'},{id:'enhanced',quality_score:42,updated_at:'2026-08-20'},{id:'priority',quality_score:12,updated_at:'2026-08-01'}];
  const promotions=[{listing_id:'enhanced',tier:'enhanced_visibility',ends_at:'2026-09-30'},{listing_id:'priority',tier:'highest_visibility',ends_at:'2026-09-30'},{listing_id:'irrelevant',tier:'highest_visibility',ends_at:'2026-09-30'}];
  const result=applyListingPlacement(listings,promotions,now);
  assert.deepEqual(result.map(x=>x.id),['priority','enhanced','organic']);assert.equal(result[0].quality_score,12);
  assert.equal(listings[0].id,'organic');
  assert.deepEqual(applyListingPlacement(listings,promotions,Date.parse('2026-10-01')).map(x=>x.id),['organic','enhanced','priority']);
  assert.deepEqual(applyListingPlacement(listings.filter(x=>x.id==='organic'),promotions,now).map(x=>x.id),['organic']);
});
