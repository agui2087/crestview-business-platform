# Activate and verify backups

A scheduled workflow is not evidence of a usable backup. Require a successful encrypted artifact and a separately verified restore before claiming recoverability.

## Repository settings

In GitHub repository **Settings > Secrets and variables > Actions**, configure:

- `SUPABASE_DB_URL`: the authorized production PostgreSQL connection string, including its database password. A Supabase API service key is not a database password.
- `NEXT_PUBLIC_SUPABASE_URL`: the production Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: that same production project's service credential.
- `CRESTVIEW_BACKUP_PASSPHRASE`: a strong, independently retained backup-encryption passphrase. Losing it makes encrypted backups unusable.
- `RESTORE_SUPABASE_URL`: a separate, approved recovery-test project. Never production.
- `RESTORE_SUPABASE_SERVICE_ROLE_KEY`: the recovery-test project's service credential.

Values saved in Vercel or a local environment file do not automatically populate GitHub Actions secrets. Do not paste credentials into issues, source files, screenshots, or chat. Verify the source/target projects before saving anything. Protect the workflow and its source branch: a workflow with production credentials is privileged.

## Verification

1. Run **Encrypted backup and restore drill** against the reviewed main branch.
2. Confirm the backup-configuration gate passes. This checks presence only, not credential validity.
3. Confirm the database and storage backups are encrypted and the artifact is saved. If the restore configuration gate then fails, the saved backup remains available; the drill still fails.
4. Require successful decryption, byte checks, isolated database restore, schema assertions, private-object restore and cleanup. Record the run and artifact identifiers, elapsed recovery time and source backup time in the restore-test record.
5. Complete the documented application-level recovery tests, permissions and source/restored data-parity checks. The current structural check alone does not prove these.

Never rerun a restore against production to make a failing test pass. Existing encrypted artifacts do not replace independent retention or a reviewed disaster-recovery procedure.
