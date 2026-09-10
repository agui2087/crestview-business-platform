import test from 'node:test';
import assert from 'node:assert/strict';
import {workforceReadiness} from './workforce-readiness.ts';
test('setup guidance distinguishes empty, assigned and archived catalogs without implying compliance',()=>{
  const base={businessConfigured:false,locations:[],departments:[],employees:[],placements:[]};
  assert.deepEqual(workforceReadiness(base),{limited:false,businessConfigured:false,activeLocations:0,activeDepartments:0,employees:0,assignmentsToReview:0});
  const configured={businessConfigured:true,locations:[{id:'l',archived:false}],departments:[{id:'d',archived:false}],employees:[{id:'e'},{id:'e2'}],placements:[{employee_id:'e',location_id:'l',department_id:'d'}]};
  assert.equal(workforceReadiness(configured).assignmentsToReview,1);
  assert.equal(workforceReadiness({...configured,locations:[{id:'l',archived:true}]}).assignmentsToReview,2);
  assert.equal(workforceReadiness({...configured,employees:[{id:'e'}]}).assignmentsToReview,0);
});
test('setup guidance never infers missing assignments from a truncated catalog',()=>{
  const result=workforceReadiness({businessConfigured:true,locations:Array.from({length:500},(_,i)=>({id:String(i),archived:false})),departments:[],employees:[{id:'e'}],placements:[]});
  assert.equal(result.limited,true);assert.equal(result.assignmentsToReview,null);
});
