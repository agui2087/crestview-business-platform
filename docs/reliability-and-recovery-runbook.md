# Crestview reliability and recovery runbook

## Service targets

- Public pages and authenticated dashboard: 99.9% monthly availability target
- Stripe webhook processing: 99.95% successful delivery target, excluding rejected invalid signatures
- Recovery time objective: restore essential buyer, broker, and billing access within four hours
- Recovery point objective: no more than 24 hours of database change loss until point-in-time recovery is enabled and verified

## Monitoring

1. The `Production monitor` GitHub workflow checks application health, the database, both localized homepages, marketplace, and pricing every 15 minutes
2. The monitor retries failures once, opens or updates a GitHub incident after two consecutive failures, and closes the incident automatically after recovery
3. Treat response times above 2.5 seconds as failures; inspect the workflow summary to identify the affected route
4. Configure `CRESTVIEW_ALERT_WEBHOOK_URL` and optional `CRESTVIEW_ALERT_WEBHOOK_TOKEN` as sensitive, server-only Production variables. Error-level server events are sent to that approved receiver with a two-second timeout; delivery failures never replace the original response
5. Search Vercel logs and the receiver for structured events, especially `request.unhandled_error`, `health.database_failed`, `stripe.payment_failed`, `stripe.webhook_failed`, `document.upload_failed`, `document.scan_unavailable`, and `auth.provider_failed`
6. Send a controlled staging test through each category, then verify the receiver contains only environment, event, route, request ID, sanitized error, and allowlisted details. Never send bodies, files, authorization headers, cookies, signatures, emails, names, or financial fields
7. Review Stripe Workbench for failed deliveries daily and after every billing release; monitoring is a second signal, not a replacement for Stripe reconciliation
8. Confirm the scheduled workflow is running in the actual GitHub production repository. Its repository guard intentionally prevents forks/mirrors from opening incidents
9. Never copy raw customer documents, authorization headers, cookies, webhook signatures, or financial data into an incident ticket

## Database backups

1. Confirm the Supabase project's managed backup schedule, retention, and point-in-time recovery coverage in its dashboard. Database backups do not contain private Storage object bytes, so both database and object coverage are required
2. Add `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESTORE_SUPABASE_URL`, `RESTORE_SUPABASE_SERVICE_ROLE_KEY`, and a randomly generated `CRESTVIEW_BACKUP_PASSPHRASE` as GitHub Actions secrets. The restore project must be isolated and must not equal production
3. Manually run `Encrypted backup and restore drill`. It dumps the `public` and `auth` schemas, restores them to an isolated ephemeral PostgreSQL service, validates critical tables/counts, downloads all private `vault-files` and `deal-files`, verifies hashes, restores the bytes to temporary buckets in the isolated Supabase project, verifies them again, and removes the temporary buckets
4. The workflow encrypts database/storage artifacts with AES-256-CBC/PBKDF2 before upload and expires them after 30 days. Keep the passphrase in an approved secrets manager separate from the artifacts
5. Complete `docs/restore-test-record-template.md`. Record timestamp, RPO/RTO, counts, hashes, duration, release/migration, operator, reviewer, and exceptions—never customer content or credentials
6. Run the drill at least quarterly and after material storage/auth/schema changes. The weekly schedule may remain enabled once cost, artifact access, and alert ownership are approved
7. Before destructive schema work, create a recoverable backup or confirm PITR coverage; keep migrations forward-compatible under `supabase/migrations`
8. Treat a failed backup, restore, hash check, cleanup, or missing secret as an incident. A backup is not “verified” until an isolated restore passes

## Incident response

1. Confirm impact using the health endpoint, Vercel logs, Supabase status, and Stripe Workbench
2. Stop the failing release or disable the affected feature; do not delete production data while diagnosing
3. For an application regression, redeploy the last known-good Vercel production deployment
4. For a database regression, prefer a forward migration. Restore only when the database cannot be repaired safely
5. Re-send failed Stripe events only after the webhook endpoint is healthy; event processing is idempotent
6. Verify buyer and broker access with non-sensitive test accounts before closing the incident
7. Document cause, scope, timeline, recovery, and prevention within two business days

## Release verification

- Typecheck, lint, tests, and production build pass
- `/api/health` returns HTTP 200 and reports application/database `ok`
- One buyer and one broker smoke path load successfully
- Stripe test webhook returns HTTP 200 after billing changes
- A rollback target is identified before high-risk releases

## Document security screening

1. Keep `CLOUDMERSIVE_VIRUS_API_KEY` server-side and marked sensitive in Vercel; never expose it through a `NEXT_PUBLIC_` variable
2. With the key configured, vault files, listing NDAs, and deal-room files are released only after the managed scanner returns a clean result
3. Scanner timeouts, provider errors, and malformed responses fail closed; the new file is not released and an existing replacement remains unchanged
4. Without the key, Crestview performs signature, executable, active-PDF, and antivirus-test checks and labels the result “File safety checked,” not “malware scanned”
5. Review `document_security_events` for blocked files and provider outages without opening or copying customer documents
6. Before enabling a third-party scanner in production, ensure Crestview's privacy disclosures and vendor terms cover transfer of uploaded customer files to the scanner
7. After vendor approval, Geo adds `CLOUDMERSIVE_VIRUS_API_KEY` as a sensitive Production-only Vercel variable and redeploys. Never use a `NEXT_PUBLIC_` name, paste the value into a terminal transcript, or commit it
8. Run `npm run verify:scanner` from an approved environment with the key supplied through its secret store. It sends one minimal clean PDF and the standard EICAR antivirus test string directly to Cloudmersive; it must accept the first and reject the second
9. In isolated staging, verify a clean vault file, listing NDA, and deal-room file reach `malware_scanned`; EICAR is blocked and never stored; an invalid/withheld provider key returns a safe failure and does not replace an existing document
10. Review `document_security_events` and redacted application alerts. Store no customer bytes, names, or key material in the verification record

## Private-pilot operations

1. Apply migration `0026_private_pilot_feedback.sql` before enabling the pilot feedback link
2. Verify `pilot_events` accepts only page/task identifiers and small allowlisted metadata; never add document text, financial values, messages, names, emails, or external advertising identifiers
3. Delete page events after 90 days and delete or de-identify feedback after 180 days, subject to counsel-approved holds
4. Follow `docs/pilot-plan.md` and `docs/pilot-checklist.md`; pause on cross-account access, data loss, or privacy/security exposure
