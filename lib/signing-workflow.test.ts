import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signingState,mayRemind} from './signing-workflow.ts';
test('signing status and reminder availability respect server timestamps',()=>{
 const now=Date.parse('2026-09-19T00:00:00Z');
 assert.equal(signingState('sent',{expires_at:'2026-09-19T00:00:00Z'},now),'expired');
 assert.equal(signingState('signed',{expires_at:'2026-09-18T00:00:00Z'},now),'signed');
 assert.equal(signingState('sent',{withdrawn_at:'2026-09-18T00:00:00Z'},now),'withdrawn');
 assert.equal(mayRemind('sent',{last_reminded_at:'2026-09-18T01:00:00Z'},now),false);
 assert.equal(mayRemind('sent',{last_reminded_at:'2026-09-18T00:00:00Z'},now),true);
 for(const status of ['signed','declined','superseded','draft'])assert.equal(mayRemind(status,null,now),false);
});
