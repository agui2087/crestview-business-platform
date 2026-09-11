import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, savedOpportunitiesCsv } from './customer-export.ts';
test('customer exports contain only supplied saved records and preserve quoting', () => {
  const csv = savedOpportunitiesCsv([{opportunity_key:'private-key',stage:'diligence',next_action:'Call',notes:'Private, "note"',updated_at:'2026-09-11'}], new Map([['private-key','Actual saved deal']]), false);
  assert.ok(csv.includes('Actual saved deal')); assert.ok(csv.includes('Private, ""note""')); assert.equal(csv.split('\r\n').length,2);
  assert.equal(savedOpportunitiesCsv([],new Map(),true).split('\r\n').length,1);
});
test('customer export neutralizes spreadsheet formula prefixes', () => {
  for (const input of ['=1+1','+CMD','-1','@SUM(A1)','  =1','\tdata','\n=1']) assert.ok(csvCell(input).startsWith('"\''));
  assert.equal(csvCell('Normal'),'"Normal"');
});
