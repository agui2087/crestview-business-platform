import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.WORKBOOK_CHECK_ORIGIN;
if (!url || !key || !origin) throw new Error('Explicit database and site configuration required');
if (!['https://gsabakontancxutgsbem.supabase.co', 'https://bxtrkycetuoqooammgpp.supabase.co'].includes(url)) throw new Error('Unknown database');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `workbook-check-${randomUUID()}@crestview.test`;
const password = randomUUID() + randomUUID();
const browser = await chromium.launch({ headless: true });
let uid: string | undefined;
try {
  const page = await browser.newPage();
  let authenticatedOrigin = origin;
  const download = () => page.request.get(`${authenticatedOrigin}/api/export/financial-due-diligence`);
  assert.equal((await download()).status(), 401, 'signed out denied');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Synthetic account creation failed');
  uid = created.data.user.id;
  await page.goto(`${origin}/en/sign-in`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/en/dashboard', { timeout: 60000 });
  authenticatedOrigin = new URL(page.url()).origin;
  assert.equal((await download()).status(), 403, 'free account denied');
  const inserted = await admin.from('billing_entitlements').insert({ user_id: uid, product_code: 'crestview_pro', active: true, quantity: 1, source_event_id: `synthetic-workbook-${uid}` });
  if (inserted.error) throw new Error('Synthetic entitlement setup failed');
  const paid = await download();
  assert.equal(paid.status(), 200);
  assert.equal(paid.headers()['cache-control'], 'private, no-store');
  assert.match(paid.headers()['content-disposition'], /\.xlsx/);
  const bytes = await paid.body();
  assert.equal(bytes.readUInt32LE(), 0x04034b50, 'XLSX ZIP signature');
  if (process.argv.includes('--expect-corrected')) assert.equal(createHash('sha256').update(bytes).digest('hex'), '7bfd3b5220d8720ae52107ef2d324075066baeaaa999cc7830b1b9a68d8672c5', 'live bytes match corrected workbook');
  for (const state of [{ active: true, expires_at: '2000-01-01T00:00:00Z' }, { active: false, expires_at: null }]) {
    const changed = await admin.from('billing_entitlements').update(state).eq('user_id', uid).eq('product_code', 'crestview_pro');
    if (changed.error) throw new Error('Synthetic state update failed');
    assert.equal((await download()).status(), 403, 'expired or revoked access denied');
  }
  console.log('PASS: signed-out, free, paid, expired and revoked workbook access; private download headers and XLSX bytes.');
} finally {
  await browser.close();
  if (uid && (await admin.auth.admin.deleteUser(uid)).error) throw new Error('Synthetic account cleanup failed');
  console.log('Synthetic account cleanup complete.');
}
