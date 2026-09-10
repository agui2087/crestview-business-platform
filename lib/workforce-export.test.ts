import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell,employeeCsv } from './workforce-export.ts';
import { parseEmployeeCsv } from './workforce.ts';
test('workforce exports neutralize spreadsheet formulas',()=>{
  for(const value of ['=1+1','+SUM(A1)','-1+2','@SUM(A1)',' \t=1']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Doe, "Jane"'),'"Doe, ""Jane"""');
});
test('workforce export and import preserve supported values',()=>{
  const row={full_name:'Doe, Jane',email:'jane@example.com',position:'Lead',department:'Operations',manager_name:'Jo',start_date:'2026-01-01',employment_status:'leave',preferred_locale:'es'};
  assert.deepEqual(parseEmployeeCsv(employeeCsv([row])),[row]);
});
