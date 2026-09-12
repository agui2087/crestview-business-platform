# Private Pro workbook delivery

The paid XLSX is stored in the existing Supabase project, in the private `paid-workbooks` bucket. It is not committed to GitHub or served from `/public`. The file version is identified in `lib/private-workbook.ts`.

The download route verifies the signed-in user and current Pro entitlement before fetching the object using server-only credentials. It returns an attachment with `private, no-store` caching and never exposes a signed or public storage URL. Missing storage or billing access fails closed. Existing acquisition-document controls are unchanged.

To install the reviewed file, run `scripts/install-private-workbook.mts` with the XLSX path and the target project's existing environment configuration. The script verifies the approved file hash, refuses a public bucket or a different existing version, and tests both public and direct signed-in access denial. Never commit credentials or the workbook itself.

Verify deployment with `scripts/verify-workbook-access.mts --expect-corrected`, configured with the existing project environment and `WORKBOOK_CHECK_ORIGIN`. It creates and deletes a synthetic account and checks signed-out, free, Pro, expired and revoked access, plus the exact downloaded file hash.

This uses existing storage, not a new subscription. Normal account storage and bandwidth limits still apply; no plan upgrade or paid feature is enabled. The workbook is approximately 25 KB. Historical GitHub copies are intentionally not rewritten. Paid users can still save or redistribute files they legitimately download; private storage prevents unauthenticated retrieval, not all copying.
