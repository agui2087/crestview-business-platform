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
4. Search Vercel logs for structured events with `level=error`, especially `request.unhandled_error`, `stripe.webhook_failed`, and `health.database_failed`
5. Review Stripe Workbench for failed deliveries daily and after every billing release
6. Never copy raw customer documents, authorization headers, cookies, webhook signatures, or financial data into an incident ticket

## Database backups

1. Confirm the Supabase project's current backup schedule and retention in the Supabase dashboard
2. Before destructive schema work, create a recoverable backup or confirm point-in-time recovery coverage
3. Keep migrations forward-compatible; production schema changes must be committed under `supabase/migrations`
4. Once per quarter, restore the newest backup into an isolated non-production project
5. Validate user profiles, listings, inquiries, NDAs, document metadata, entitlements, and Stripe event IDs after restoration
6. Record the backup timestamp, restore duration, validation result, and operator without including customer content

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
