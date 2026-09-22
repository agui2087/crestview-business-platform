# Document replacement release checklist

Status on 2026-09-22: implemented and isolated connected rehearsal passed;
production release requires the hosted checks and production migration below.

## Implementation

- Migration 0074 adds replacement lineage, notes and superseded timestamps.
- A newly uploaded file is screened through the existing upload controls and kept
  private until an atomic authorized replacement RPC succeeds.
- The RPC locks both records, rejects stale version/access choices, preserves the
  original, inherits sharing/title/category, increments the version and rebinds
  document requests. It never rewrites NDA evidence.
- Direct browser changes to file/revision fields and deletion of referenced
  originals are restricted. Archived originals are not buyer-readable.
- Uncertain RPC outcomes never trigger deletion of either file.
- Broker UI offers replacement with a change note and previous-version history.

## Passed locally

- 301 automated tests, lint and type checking.
- Production webpack build.
- PostgreSQL-compatible replacement regression covering authorization, stale
  versions/access, screening, original retention, request links, buyer visibility
  and protected original storage records.

## Must finish before release

1. DONE: migration 0074 applied to isolated project bxtrkycetuoqooammgpp.
2. DONE: `scripts/verify-document-replacement.mts` verified actual screened browser
   uploads and replacement, rejected malformed file retaining the original,
   inherited sharing, version 2, request rebinding, new download contents, old URL
   and archived storage denial, outsider/buyer/stale replacement rejection,
   independent financial approval and English/Spanish phone layouts. Screenshots
   inspected; all synthetic records, accounts and files removed.
3. Run complete hosted checks on a scoped pull request.
4. Only after checks pass, apply the additive migration to production
   gsabakontancxutgsbem, then merge/deploy and verify the live release.

The new page queries new columns, so do not deploy it before the migration.
Production database changes have not yet been applied at release submission.
Existing temporary storage tokens and copies already downloaded cannot be recalled.

## Previous completed release

PR110, production f4cb9a0: session-checked deal-file delivery is live. Hosted checks
passed (300 tests, 89 browser checks, 3 existing skips, 10 purchase checks). Real
isolated CSV/PDF and rendered PDF tests passed with cleanup. Live health verified
and anonymous file access returned 404 with private/no-store headers.
