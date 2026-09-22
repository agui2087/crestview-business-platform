import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('listing financial context preserves unknowns and rejects incomplete or misleading values',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create table marketplace_listings(id integer primary key);insert into marketplace_listings values(1);');
  await db.exec(await readFile(new URL('../supabase/migrations/0069_listing_financial_context.sql',import.meta.url),'utf8'));
  assert.deepEqual((await db.query('select cash_flow_basis,financial_figure_type,financial_period_start from marketplace_listings')).rows,[{cash_flow_basis:'not_specified',financial_figure_type:'not_specified',financial_period_start:null}]);
  for(const sql of ["financial_period_start='2025-01-01'","financial_period_start='2025-12-31',financial_period_end='2025-01-01'","cash_flow_basis='verified'","financial_figure_type='guaranteed'","financial_context_note=repeat('x',1001)"]) {
   await assert.rejects(db.exec(`update marketplace_listings set ${sql}`));
  }
  await db.exec("update marketplace_listings set financial_period_start='2025-01-01',financial_period_end='2025-12-31',cash_flow_basis='sde',financial_figure_type='actual'");
  await db.exec("update marketplace_listings set financial_period_start=null,financial_period_end=null,cash_flow_basis='not_specified',financial_figure_type='not_specified'");
 } finally {await db.close();}
});
