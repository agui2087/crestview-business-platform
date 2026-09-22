import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buyerProfileSchema } from "./buyer-profile.ts";

test("buyer profile transaction is self-only, anonymous-denied and rolls back both halves", async () => {
  const db = new PGlite();
  const buyer = "00000000-0000-4000-8000-000000000001";
  const other = "00000000-0000-4000-8000-000000000002";
  const migration = async (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon;
      insert into auth.users values ('${buyer}'),('${other}');`);
    await db.exec(await migration("0004_buyer_workspace.sql"));
    const trust = await migration("0013_marketplace_trust_and_profiles.sql");
    await db.exec(trust.slice(trust.indexOf("alter table public.buyer_preferences"), trust.indexOf("alter table public.marketplace_listings")));
    const finance = await migration("0016_buyer_command_center.sql");
    await db.exec(finance.slice(0, finance.indexOf("drop policy")));
    await db.exec(await migration("0065_atomic_buyer_profile.sql"));
    const payload = buyerProfileSchema.parse({ industries: "Roofing", locations: "Oregon", minimum_price: "", maximum_price: "250000", minimum_cash_flow: "", desired_owner_income: "", available_cash: "0", buyer_injection_percent: "15", illustrative_interest_rate: "0", owner_involvement: "flexible", experience_level: "first_time", acquisition_timeline: "exploring", funding_status: "exploring", credit_readiness: "not_provided", risk_tolerance: "balanced", buyer_summary: "", seller_financing_preferred: false, proof_of_funds_status: "not_provided", share_summary: "private", share_experience: "private", share_financial: "private" });
    const save = (data: object) => db.query("select public.save_my_buyer_profile($1::jsonb)", [JSON.stringify(data)]);
    await db.exec("set role anon"); await assert.rejects(save(payload));
    await db.exec("reset role; set role authenticated"); await assert.rejects(save(payload));
    await db.query("select set_config('test.uid',$1,false)", [buyer]);
    await save(payload);
    assert.equal(Number((await db.query<{available_cash:string}>("select available_cash from buyer_financial_profiles")).rows[0].available_cash), 0);
    await assert.rejects(save({ ...payload, user_id: other }));
    await assert.rejects(save({ ...payload, proof_of_funds_status: "verified" }));
    // The preferences write happens first, but must roll back when the financial constraint fails.
    await assert.rejects(save({ ...payload, maximum_price: 999999, buyer_injection_percent: 100 }));
    assert.equal(Number((await db.query<{maximum_price:string}>("select maximum_price from buyer_preferences")).rows[0].maximum_price), 250000);
    await db.query("select set_config('test.uid',$1,false)", [other]);
    assert.equal((await db.query("select * from buyer_preferences")).rows.length, 0);
    assert.equal((await db.query("select * from buyer_financial_profiles")).rows.length, 0);
  } finally { await db.close(); }
});
