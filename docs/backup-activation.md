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

## Backup incidents

The separate **Backup incident monitor** runs after a main-branch scheduled or manually dispatched drill completes, including failure before the backup's checkout step. It also reconciles the latest completed drill when the monitor itself is released on main, without rerunning a backup or touching production data. It opens or updates a bot-owned GitHub issue when the latest completed drill did not pass. A later passing drill closes that workflow incident; it does not certify application-level recovery. Repeated delivery of the same run/attempt is deduplicated, and stale completions cannot close a newer failure.

The monitor uses reviewed main-branch code, never the triggering branch's code, artifacts, or logs. It receives no backup credentials. Public incident text contains only a fixed description, outcome and run link—not customer data, connection strings or raw errors. GitHub notification delivery depends on the repository's configured subscriptions; this is not a verified email, SMS or on-call service. It also cannot detect a disabled schedule or a run that never emits a completion event. Continue checking the age and usability of the latest saved backup independently.
