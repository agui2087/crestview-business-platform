import test from 'node:test';
import assert from 'node:assert/strict';
import { workforceNextActions } from './workforce-actions.ts';
test('action queue omits self-review, wrong reviewers and archived profiles',()=>{
  const base={employees:[{id:'e',full_name:'Example',archived_at:null},{id:'a',full_name:'Archived',archived_at:'2026-01-01'}],requests:[{id:'r1',employee_id:'e',kind:'leave',status:'pending',created_by:'employee',approver_id:'manager'},{id:'r2',employee_id:'e',kind:'profile',status:'pending',created_by:'employee',approver_id:'manager'},{id:'r3',employee_id:'e',kind:'leave',status:'pending',created_by:'manager',approver_id:'manager'}],tasks:[{id:'t1',employee_id:'e',title:'Training',status:'completed',due_on:'2026-01-01',completed_by:'manager',verified_at:null},{id:'t2',employee_id:'a',title:'Archived task',status:'open',due_on:'2026-01-01',completed_by:null,verified_at:null}],userId:'manager',role:'manager',today:'2026-09-10'};
  assert.deepEqual(workforceNextActions(base).map(x=>x.id),['r1']);
  assert.deepEqual(workforceNextActions({...base,role:'employee'}),[]);
  assert.deepEqual(workforceNextActions({...base,userId:'owner',role:'owner'}).map(x=>x.id),['r1','r2','r3','t1']);
});
