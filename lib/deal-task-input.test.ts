import test from 'node:test';
import assert from 'node:assert/strict';
import {dealTaskInput,dealTaskUpdate} from './deal-task-input.ts';
test('tasks accept general tasks and reject invalid titles, dates and priorities',()=>{
 const input={title:' Call broker ',opportunity_key:'',due_date:'',priority:'medium'};
 assert.deepEqual(dealTaskInput.parse(input),{title:'Call broker',opportunity_key:null,due_date:null,priority:'medium'});
 for(const change of [{title:''},{title:'a'.repeat(301)},{due_date:'2025-02-30'},{priority:'critical'}])assert.equal(dealTaskInput.safeParse({...input,...change}).success,false);
 assert.equal(dealTaskUpdate.safeParse({id:'other',status:'complete'}).success,false);
 assert.equal(dealTaskUpdate.safeParse({id:'00000000-0000-4000-8000-000000000001',status:'deleted'}).success,false);
});
