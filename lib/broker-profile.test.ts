import {test} from 'node:test';
import assert from 'node:assert/strict';
import {brokerProfileSchema} from './broker-profile.ts';
const draft={display_name:'Example Broker',brokerage:'',biography:'',service_areas:'',specialties:'',languages:'',buyer_approach:'',welcomes_preparing_buyers:true,published:false};
test('broker drafts require no private financial or contact information',()=>{assert.equal(brokerProfileSchema.safeParse(draft).success,true);});
test('publication requires a meaningful biography',()=>{assert.equal(brokerProfileSchema.safeParse({...draft,published:true}).success,false);assert.equal(brokerProfileSchema.safeParse({...draft,published:true,biography:'I help first-time buyers prepare for the acquisition process.'}).success,true);});
test('broker text limits and explicit publication flag are enforced',()=>{assert.equal(brokerProfileSchema.safeParse({...draft,display_name:'x'}).success,false);assert.equal(brokerProfileSchema.safeParse({...draft,biography:'x'.repeat(2001)}).success,false);assert.equal(brokerProfileSchema.safeParse({...draft,published:'true'}).success,false);});
