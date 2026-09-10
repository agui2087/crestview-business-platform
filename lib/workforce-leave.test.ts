import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedLeaveMinutes,leaveBalance,proposedAccrual} from './workforce-leave.ts';
import type {LeaveLedgerEntry} from './workforce-leave.ts';
const schedule={startsOn:'2026-01-01',endsOn:null,dailyMinutes:[480,480,480,480,480,0,0]};
const policy={startsOn:'2026-01-01',endsOn:null,reviewed:true,excludeHolidays:true};
test('leave plan uses weekday minutes and explicit holiday rules without UTC/DST drift',()=>{
  const result=plannedLeaveMinutes({start:'2026-03-06',end:'2026-03-10',schedules:[schedule],policies:[policy],holidays:['2026-03-09']});
  assert.equal(result.ok,true);if(result.ok){assert.equal(result.value.minutes,960);assert.deepEqual(result.value.days.map(d=>d.minutes),[480,0,0,0,480]);}
  const included=plannedLeaveMinutes({start:'2026-03-09',end:'2026-03-09',schedules:[schedule],policies:[{...policy,excludeHolidays:false}],holidays:['2026-03-09']});
  assert.deepEqual(included,{ok:true,value:{minutes:480,days:[{date:'2026-03-09',minutes:480,holidayExcluded:false}]}});
});
test('leave plan fails closed for gaps, overlap, invalid dates and unreviewed configuration',()=>{
  const base={start:'2026-03-09',end:'2026-03-10',schedules:[schedule],policies:[policy],holidays:[]};
  for(const changes of [{holidays:null},{schedules:[]},{schedules:[schedule,schedule]},{policies:[]},{policies:[policy,policy]},{policies:[{...policy,reviewed:false}]},{end:'2026-02-30'},{end:'2027-03-11'},{schedules:[{...schedule,endsOn:'2026-03-09'}]},{schedules:[{...schedule,dailyMinutes:[-1,0,0,0,0,0,0]}]}])assert.equal(plannedLeaveMinutes({...base,...changes}).ok,false);
  const changed=plannedLeaveMinutes({...base,schedules:[{...schedule,endsOn:'2026-03-09'},{...schedule,startsOn:'2026-03-10',dailyMinutes:[240,240,240,240,240,0,0]}]});
  assert.equal(changed.ok&&changed.value.minutes,720);
});
test('ledger preserves signed adjustments, excludes future entries and requires explicit opening balance',()=>{
  const entries:LeaveLedgerEntry[]=[{id:'open',date:'2026-01-01',minutes:0,kind:'opening',reference:'approved migration'},{id:'earn',date:'2026-02-01',minutes:600,kind:'accrual',reference:'february'},{id:'use',date:'2026-02-02',minutes:-480,kind:'taken',reference:'approved request'},{id:'future',date:'2026-03-01',minutes:600,kind:'accrual',reference:'march'}];
  assert.deepEqual(leaveBalance(entries,'2026-02-28'),{ok:true,value:{minutes:120,entryCount:3}});
  assert.equal(leaveBalance(entries.slice(1),'2026-02-28').ok,false);
  assert.equal(leaveBalance([...entries,entries[1]],'2026-02-28').ok,false);
  assert.equal(leaveBalance([{...entries[0],date:'2026-02-03'},...entries.slice(1)],'2026-02-28').ok,false);
  assert.equal(leaveBalance([entries[0],{...entries[2],minutes:480}],'2026-02-28').ok,false);
  assert.deepEqual(leaveBalance([entries[0],{...entries[2],minutes:-480}],'2026-02-28'),{ok:true,value:{minutes:-480,entryCount:2}}); // never silently clamp debt
});
test('proposed accrual caps additions and refuses duplicate or unreviewed periods',()=>{
  const base={reviewed:true,amountMinutes:600,currentBalanceMinutes:900,balanceCapMinutes:1000,periodReference:'policy-v1:2026-02',postedReferences:[] as string[]};
  assert.deepEqual(proposedAccrual(base),{ok:true,value:{minutes:100,reference:base.periodReference}});
  assert.equal(proposedAccrual({...base,reviewed:false}).ok,false);
  assert.equal(proposedAccrual({...base,postedReferences:[base.periodReference]}).ok,false);
  assert.deepEqual(proposedAccrual({...base,currentBalanceMinutes:1100}),{ok:true,value:{minutes:0,reference:base.periodReference}});
  assert.deepEqual(proposedAccrual({...base,balanceCapMinutes:null}),{ok:true,value:{minutes:600,reference:base.periodReference}});
});
