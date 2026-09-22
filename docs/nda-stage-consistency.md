# NDA stage consistency: bounded release

## Scope
Complete the mismatch where the UI projected `nda_signed` from an existing signed
agreement but broker stage changes and buyer financial requests used persisted
`nda_sent` and failed. This is not external signing, packets, or email delivery.

## Implementation
- Migration 0073 repairs only `nda_sent` inquiries with a `signed` NDA belonging
  to the same buyer and broker. It records a restricted system reconciliation
  receipt, without inventing a user action or a new signature.
- Agreement evidence, financial decisions and document permissions are untouched.
- Deferred database checks reject a signed-NDA/`nda_sent` mismatch at transaction
  commit. Existing signing RPCs can still write agreement and stage atomically.
- Closed, declined and later stages are preserved. Partial countersigning is not
  a completed agreement and does not advance the stage or unlock documents.
- Workspace stage display and offered actions now use the same persisted stage
  as the server. Signature evidence still independently governs document access.

## Verification
- PostgreSQL tests cover scoped legacy repair, unchanged evidence, terminal and
  partial-signing preservation, failed non-atomic writes, atomic completion,
  broker advancement, buyer denial, stale versions and restricted repair receipts.
- Existing signing tests run with 0073 installed: typed, visual, buyer-first,
  broker-first and any-order countersigning; original access guards stay active.
- `scripts/verify-nda-stage.mts` performs an isolated synthetic rehearsal:
  seed before migration, apply migration, verify through buyer/broker browser
  sessions, then cleanup. It refuses the production database. Its temporary
  account credentials stay outside the repository in a mode-0600 fixture file.
- Connected rehearsal passed: signed evidence unchanged, consistent displayed
  stage, actual broker advancement, financial request then separate approval,
  approval-only and broker-only access restrictions, outsider denial, and EN/ES
  phone overflow checks. Build and focused lint passed.
- Production preflight on 2026-09-22 found zero matching legacy mismatches; no
  production customer stage needed repair at that inspection.

## Release and rollback
Apply 0073 in production only after testing, before deploying the page change.
Check both constraint triggers exist and no mismatches remain, then verify the
public deployment health/release. The prior page is compatible with the migration,
so application rollback does not require undoing valid signed stages. Do not
automatically revert repaired stages or edit signed evidence during rollback.
Production completion must be verified separately, not inferred from this file.
