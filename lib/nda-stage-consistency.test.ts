import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('legacy NDA repair is scoped; partial signing and terminal stages are preserved', async () => {
  const db = new PGlite();
  const id = (n:number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table deal_inquiries(id uuid primary key,buyer_id uuid,broker_id uuid,status text,updated_at timestamptz,financial_access_status text);
      create table deal_ndas(id uuid primary key,inquiry_id uuid,buyer_id uuid,broker_id uuid,status text);
      select set_config('request.jwt.claim.role','migration_original',false);`);
    for (const [index,status] of ['nda_sent','closed','declined','document_review','nda_sent'].entries()) {
      await db.query('insert into deal_inquiries values($1,$2,$3,$4,now(),$5)',[id(index),id(90),id(91),status,'not_requested']);
      await db.query('insert into deal_ndas values($1,$2,$3,$4,$5)',[id(10+index),id(index),id(90),id(91),index===4?'sent':'signed']);
    }
    await db.exec(await readFile(new URL('../supabase/migrations/0073_signed_nda_stage_consistency.sql',import.meta.url),'utf8'));
    assert.deepEqual((await db.query<{status:string}>('select status from deal_inquiries order by id')).rows.map(r=>r.status),['nda_signed','closed','declined','document_review','nda_sent']);
    assert.equal((await db.query('select * from deal_stage_reconciliations')).rows.length,1);
    assert.equal((await db.query<{role:string}>("select current_setting('request.jwt.claim.role') role")).rows[0].role,'migration_original');
    await assert.rejects(db.query("update deal_ndas set status='signed' where inquiry_id=$1",[id(4)]),/saved together/);
    assert.equal((await db.query<{status:string}>('select status from deal_ndas where inquiry_id=$1',[id(4)])).rows[0].status,'sent');
    await db.exec('begin');
    await db.query("update deal_ndas set status='signed' where inquiry_id=$1",[id(4)]);
    await db.query("update deal_inquiries set status='nda_signed' where id=$1",[id(4)]);
    await db.exec('commit');
    assert.equal((await db.query<{n:number}>("select count(*)::int n from deal_inquiries where financial_access_status<>'not_requested'")).rows[0].n,0);
  } finally { await db.close(); }
});
