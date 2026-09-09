# Backup safety verification — 2026-09-09

Status: local safeguards tested; no production backup or hosted restore run.

## Implemented

- Restore source and target are required, normalized canonical HTTPS Supabase
  project addresses. Equivalent addresses (case/trailing slash/whitespace) are
  rejected as the same project. Custom aliases, credentials, paths and nonstandard
  ports fail closed because their isolation cannot be inferred safely.
- Manifest requires explicit buckets, matching object counts, unique object
  identities, valid sizes and SHA-256 values. Explicitly empty buckets are valid;
  missing manifest fields do not count as a successful empty backup.
- Every object is checked before any remote bucket creation. Upload rereads and
  rechecks the bytes. Absolute paths, traversal, backslashes, control characters,
  missing/corrupt files and resolved paths outside the backup root are rejected.
- Restore cleanup handles both rejected requests and returned API error objects.
  Cleanup failure exits unsuccessfully and warns that isolated private buckets
  may remain. Success is printed only after cleanup succeeds.

## Evidence

Local test suite: 52 tests passed, including three new recovery-safety tests with
multiple invalid-input cases. Byte verification uses synthetic temporary files,
including same-size corruption and a symlink pointing outside the backup root.
No customer data or remote storage was used. These checks are not a full filesystem
race defense; the runner and backup directory must be trusted and isolated.

## Still required before claiming recoverability

- Configure authorized backup credentials, encrypted artifact access and separate
  restore infrastructure. Do not run a drill against production storage.
- Exercise cleanup failures against a controlled mocked/isolated service.
- Restore from the encrypted artifact itself, including decryption/checksum proof,
  rather than only from the plaintext generated earlier in the job.
- Make database assertions fail on missing tables, compare source/restored counts,
  and verify required roles/extensions/storage dependencies in the restore image.
- Prove buyer/broker sign-in, document access controls and metadata-to-object
  consistency against the restored application; record measured recovery time and
  data loss window in the restore-test record.
- Review authenticated encryption, independent backup retention, and preserving
  the database artifact even when object backup fails. The existing CBC encryption
  plus a co-located checksum is not independent proof against malicious tampering.

No backup schedule or hosted service was changed by this local patch.
