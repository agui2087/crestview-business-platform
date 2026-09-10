import test from 'node:test';import assert from 'node:assert/strict';
import {parsePayrollCsv,payrollColumns,payrollSummary} from './workforce-payroll.ts';
const id='00000000-0000-4000-8000-000000000001';
const header=payrollColumns.join(',');const row=`${id},2026-08-01,2026-08-15,USD,1000.10,1200.20,80.25,source-aug`;
test('canonical payroll parser preserves decimal precision and source periods',()=>{
  const rows=parsePayrollCsv(`\uFEFF${header}\r\n${row}\r\n`);assert.equal(rows[0].grossMinor,100010);assert.equal(rows[0].employerCostMinor,120020);assert.equal(rows[0].paidHoursHundredths,8025);
  const quoted=parsePayrollCsv(`${header}\n${row.replace('source-aug','"source, august"')}`);assert.equal(quoted[0].sourceReference,'source, august');
});
test('payroll parser rejects missing/extra/sensitive columns, duplicates and unsafe values',()=>{
  for(const csv of [`${header},ssn\n${row},123`,`${header}\n${row}\n${row}`,`${header}\n${row.replace('1000.10','')}`,`${header}\n${row.replace('1000.10','-10')}`,`${header}\n${row.replace('1000.10','1e3')}`,`${header}\n${row.replace('1000.10','1000.101')}`,`${header}\n${row.replace('1200.20','900')}`,`${header}\n${row.replace('2026-08-15','2026-02-30')}`,`${header}\n${row.replace('USD','JPY')}`,`${header}\n${row.replace('source-aug','=SUM(A1)')}`,`${header}\n${row.replace('80.25','361')}`,`${header}\n${row.replace('source-aug','"unclosed')}`])assert.throws(()=>parsePayrollCsv(csv));
});
test('payroll summary separates currencies and periods; no implied FX conversions',()=>{
  const rows=parsePayrollCsv(`${header}\n${row}\n${row.replace(id,'00000000-0000-4000-8000-000000000002').replace('USD','EUR')}\n${row.replace('2026-08-01','2026-08-16').replace('2026-08-15','2026-08-31')}`);
  assert.equal(payrollSummary(rows).length,3);
});
test('payroll parser accepts 500 rows and refuses truncation or missing rows',()=>{
  const rows=Array.from({length:500},(_,i)=>row.replace(id,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`));
  assert.equal(parsePayrollCsv(`${header}\n${rows.join('\n')}`).length,500);
  assert.throws(()=>parsePayrollCsv(`${header}\n${rows.join('\n')}\n${row}`));
  assert.throws(()=>parsePayrollCsv(header));
  assert.throws(()=>parsePayrollCsv('é'.repeat(500001)));
});
