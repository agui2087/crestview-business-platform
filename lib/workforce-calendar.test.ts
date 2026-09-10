import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,leaveOnDay} from './workforce-calendar.ts';
test('calendar handles leap years and complete weeks',()=>{
  assert.equal(calendarDays('2024-02').filter(Boolean).length,29);
  assert.equal(calendarDays('2026-02').filter(Boolean).length,28);
  assert.equal(calendarDays('2026-09').length%7,0);
  for(const month of ['2026-13','bad','2026-1','0000-01'])assert.throws(()=>calendarDays(month));
});
test('calendar includes approved/pending dates inclusively across months',()=>{
  const requests=['pending','approved','rejected','withdrawn'].map(status=>({kind:'leave',status,starts_on:'2026-09-30',ends_on:'2026-10-02'}));
  assert.equal(leaveOnDay(requests,'2026-10-01').length,2);
  assert.equal(leaveOnDay(requests,'2026-10-02').length,2);
  assert.equal(leaveOnDay(requests,'2026-10-03').length,0);
});
