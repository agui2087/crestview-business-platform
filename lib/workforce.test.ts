import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEmployeeCsv, validDate, needsAttention, pendingTimeOff } from './workforce.ts';

test('CSV handles BOM, reordered export headers, quoted commas, escaped quotes and multiline fields', () => {
  const [row] = parseEmployeeCsv('\uFEFFpreferred_locale,full_name,position,employment_status\r\nes,"Doe, Jane","Lead ""Ops""\nManager",leave\r\n');
  assert.equal(row.full_name, 'Doe, Jane');
  assert.equal(row.position, 'Lead "Ops"\nManager');
  assert.equal(row.preferred_locale, 'es');
  assert.equal(row.employment_status, 'leave');
});
test('CSV accepts 500 employees but refuses silent truncation', () => {
  assert.equal(parseEmployeeCsv('full_name\n' + 'Jane\n'.repeat(500)).length, 500);
  assert.throws(() => parseEmployeeCsv('full_name\n' + 'Jane\n'.repeat(501)));
});
test('CSV rejects malformed headers, rows, dates, locale and quotes', () => {
  for (const csv of ['name\nJane', 'full_name,full_name\nJane,Doe', 'full_name\nJane,extra', 'full_name\n"Jane', 'full_name\n"Jane"x', 'full_name,start_date\nJane,2026-02-30', 'full_name,preferred_locale\nJane,fr', 'full_name\n']) assert.throws(() => parseEmployeeCsv(csv));
});
test('date validation rejects impossible dates', () => {
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
});
test('attention includes expired and 60-day certifications but excludes PTO', () => {
  for (const expires_on of ['2025-01-01', '2026-09-09', '2026-11-08']) assert.equal(needsAttention({record_type:'certification', expires_on}, '2026-09-09'), true);
  assert.equal(needsAttention({record_type:'document', expires_on:'2026-11-09'}, '2026-09-09'), false);
  assert.equal(needsAttention({record_type:'pto', expires_on:'2025-01-01'}, '2026-09-09'), false);
});
test('only pending and legacy active time off count as pending', () => {
  for (const status of ['pending', 'active']) assert.equal(pendingTimeOff({record_type:'pto',status}), true);
  for (const status of ['approved', 'rejected', 'completed']) assert.equal(pendingTimeOff({record_type:'pto',status}), false);
});
