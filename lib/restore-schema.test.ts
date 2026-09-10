import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('restore structure check fails for missing tables and disabled RLS',async()=>{
  const db=new PGlite();
  try {
    const check=await readFile(new URL('../scripts/assert-restored-schema.sql',import.meta.url),'utf8');
    await assert.rejects(db.exec(check),/missing required relation/);
    const tables=['profiles','marketplace_listings','deal_inquiries','vault_documents','billing_entitlements','stripe_webhook_events','employees','workforce_members','workforce_leave_policies','workforce_leave_ledger','workforce_training_evidence','workforce_accrual_rules','workforce_accrual_history','workforce_accrual_runs'];
    for(const table of tables)await db.exec(`create table public.${table}(id integer)`);
    await assert.rejects(db.exec(check),/RLS disabled/);
    for(const table of tables)await db.exec(`alter table public.${table} enable row level security`);
    await db.exec(check);
  }finally {await db.close();}
});
