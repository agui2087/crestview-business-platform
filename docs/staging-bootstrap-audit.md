# Staging bootstrap audit — 2026-09-10

Production remains unchanged at PR51. This is an environment diagnostic, not a new live feature or a passed browser test.

Read-only inspection of staging project `bxtrkycetuoqooammgpp` found one auth account and five public tables: billing_customers, billing_entitlements, billing_subscriptions, stripe_checkout_fulfillments and stripe_webhook_events. No profiles, employees, Workforce membership/leave tables or private vault exist. Existing staging billing data must be preserved. Production is the different project `gsabakontancxutgsbem`.

`node --experimental-strip-types --test lib/workforce-staging-baseline.test.ts` now passes the complete released migration sequence through 0041, excluding unreleased 0027/0028. It creates only an in-memory PGlite instance with synthetic auth/storage schema interfaces. It has no network, credentials or hosted database connection. The pgcrypto extension statement is omitted only in this test because PGlite already supplies gen_random_uuid. This is not hosted Supabase/storage/browser acceptance.

## Confirmed migration conflict

- 0001 creates organization-based saved_opportunities with organization_id, opportunity_id, user_id and saved_at.
- 0004 uses CREATE TABLE IF NOT EXISTS for a different user-key-based saved_opportunities shape with id, opportunity_key, stage and updated_at.
- Because the first table already exists, the second creation is skipped; its subsequent index fails because stage does not exist.

Read-only production schema inspection confirmed the newer user-key-based shape (id, user_id, opportunity_key, stage, next_action, notes, created_at, updated_at, plus subsequent checklist columns). The fresh-install 0001 definition is now aligned with 0004 so a clean installation can proceed. No production migration is required or permitted for this baseline-only correction. Do not rerun 0001 on an existing database. Nonempty installations still using the historical organization-based shape require a separately reviewed preservation/backfill upgrade; this change does not migrate their records.

The full isolated sequence passes after the correction, including document-security and Workforce dependencies. The baseline test is included in the normal regression suite to prevent recurrence. Staging itself remains billing-only: preparing it requires an incremental manifest that skips already-applied billing schema and preserves its existing account/data. Do not apply the fresh-install sequence wholesale to staging.

After the baseline is validated, staging still needs the reviewed schema, isolated synthetic identities, secure configuration and browser/server/database tests. Existing form-handler/database tests remain passing but are not full hosted E2E acceptance. No staging migration, user invitation, credential change or production data mutation was performed during this audit.
