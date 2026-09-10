# Staging bootstrap audit — 2026-09-10

The baseline correction shipped in PR52. This audit is an environment diagnostic, not a new live feature or a passed browser test. No hosted database migration was executed for that release.

Read-only inspection of staging project `bxtrkycetuoqooammgpp` found one auth account and five public tables: billing_customers, billing_entitlements, billing_subscriptions, stripe_checkout_fulfillments and stripe_webhook_events. No profiles, employees, Workforce membership/leave tables or private vault exist. Existing staging billing data must be preserved. Production is the different project `gsabakontancxutgsbem`.

`node --experimental-strip-types --test lib/workforce-staging-baseline.test.ts` now passes the complete released migration sequence through 0041, excluding unreleased 0027/0028. It creates only an in-memory PGlite instance with synthetic auth/storage schema interfaces. It has no network, credentials or hosted database connection. The pgcrypto extension statement is omitted only in this test because PGlite already supplies gen_random_uuid. This is not hosted Supabase/storage/browser acceptance.

## Confirmed migration conflict

- 0001 creates organization-based saved_opportunities with organization_id, opportunity_id, user_id and saved_at.
- 0004 uses CREATE TABLE IF NOT EXISTS for a different user-key-based saved_opportunities shape with id, opportunity_key, stage and updated_at.
- Because the first table already exists, the second creation is skipped; its subsequent index fails because stage does not exist.

Read-only production schema inspection confirmed the newer user-key-based shape (id, user_id, opportunity_key, stage, next_action, notes, created_at, updated_at, plus subsequent checklist columns). The fresh-install 0001 definition is now aligned with 0004 so a clean installation can proceed. No production migration is required or permitted for this baseline-only correction. Do not rerun 0001 on an existing database. Nonempty installations still using the historical organization-based shape require a separately reviewed preservation/backfill upgrade; this change does not migrate their records.

The full isolated sequence passes after the correction, including document-security and Workforce dependencies. The baseline test is included in the normal regression suite to prevent recurrence. Staging itself remains billing-only: preparing it requires an incremental manifest that skips already-applied billing schema and preserves its existing account/data. Do not apply the fresh-install sequence wholesale to staging.

After the baseline is validated, staging still needs the reviewed schema, isolated synthetic identities, secure configuration and browser/server/database tests. Existing form-handler/database tests remain passing but are not full hosted E2E acceptance. No staging migration, user invitation, credential change or production data mutation was performed during this audit.

## Incremental rehearsal

The regression test now also begins with the released 0010 billing schema, a modeled existing checkout-receipt table and one synthetic account with a record in each of the five billing tables. It applies 0001–0041 in order while skipping 0010 (already present) and 0027/0028 (unrelated billing changes). All five billing tables' records, the existing billing-event routine definition and its privileges, and the auth account count remain unchanged. Workforce/security dependencies initialize successfully. No profile or HR access is silently created for the pre-existing account.

This proves preservation for the explicit fixture, not equivalence to hosted staging. Before applying this candidate sequence to staging, inspect its existing table definitions, routines, triggers and grants; stop on differences or any additional non-billing application tables. Preserve the existing billing implementation rather than replacing it with 0010. Capture schema and protected record-count evidence before/after. Run the reviewed bootstrap transactionally and verify role privileges before connecting a test app. Do not use this procedure on production, rerun it against an initialized application schema, or treat it as a general legacy upgrade.

Hosted staging migration, synthetic identity provisioning and full browser tests are still pending. This test adds no authentication bypass and does not contact Stripe, Supabase or any payment provider.

## Hosted metadata follow-up and guarded builder

Read-only staging inspection on September 10 (SQL editor query c06949ca-92bf-4277-9516-17cc6c7dd807) confirmed exactly five public billing tables, all RLS-enabled with no custom table triggers. Column names/types/nullability match the modeled layout. The two existing billing routines are security-definer with execute privileges limited to postgres/service_role. Three self-read billing policies are present. No custom auth.users trigger, storage bucket or storage policy was returned. One existing auth account remains. No record contents or credentials were collected.

`lib/workforce-staging-bootstrap.ts` builds a single transaction from the explicit released sequence. It accepts only the known staging project identifier, requires all expected migration numbers, skips existing billing migrations and removes individual transaction wrappers. Database preconditions reject extra application tables/views, auth triggers, storage buckets or unrelated routines. Protected billing rows and existing routine definitions/ACLs are compared before commit inside temporary transaction-local storage; unexpected changes abort. Auth account count is also preserved. This is not a substitute for verifying the target dashboard/project before execution.

The isolated integration test executes the generated transaction, checks successful preservation, rejects a second run, and injects a billing mutation to prove both billing data and newly created Workforce schema roll back together. Production-target and incomplete-manifest inputs are rejected. The builder is not imported by application request handlers and has not been executed against hosted staging or production. Hosted staging initialization and full browser E2E remain pending.
