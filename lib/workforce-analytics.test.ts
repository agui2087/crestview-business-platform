import assert from 'node:assert/strict';
import test from 'node:test';
import { workforceAnalytics } from './workforce-analytics.ts';
test('workforce analytics excludes archived/departed people, keeps completion distinct from verification',()=>{
  const employees=[{id:'1',department:'Ops',employment_status:'active',archived_at:null},{id:'2',department:null,employment_status:'leave',archived_at:null},{id:'3',department:'Ops',employment_status:'terminated',archived_at:null},{id:'4',department:'Ops',employment_status:'active',archived_at:'2026-01-01'}];
  const tasks=[{employee_id:'1',status:'completed',due_on:'2026-01-01',verified_at:null,category:'training'},{employee_id:'1',status:'open',due_on:'2026-01-01',verified_at:null,category:'onboarding'},{employee_id:'2',status:'completed',due_on:'2026-01-01',verified_at:'2026-01-02',category:'renewal'},{employee_id:'3',status:'open',due_on:'2026-01-01',verified_at:null,category:'training'}];
  const result=workforceAnalytics(employees,tasks,[], '2026-09-10');
  assert.equal(result.headcount,2);assert.equal(result.onLeave,1);assert.equal(result.tasks,3);assert.equal(result.completionRate,67);assert.equal(result.overdue,1);assert.equal(result.awaitingVerification,1);assert.equal(result.verifiedTraining,1);assert.equal(result.training,2);
  assert.equal(result.departments.reduce((sum,d)=>sum+d.count,0),2);
});
test('empty analytics shows no percentage rather than misleading 100 percent',()=>{
  assert.equal(workforceAnalytics([],[],[],'2026-09-10').completionRate,null);
});
