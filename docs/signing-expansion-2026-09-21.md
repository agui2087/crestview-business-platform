# Signing expansion release gates

This is a work-in-progress checklist, not a production completion claim.

| Workstream | Current gate |
| --- | --- |
| Email invitations and reminders | Provider adapter, durable outbox, signed delivery callbacks and worker implemented with local tests; provider signup, verified sender, scheduling and live verification remain. Disabled in production. |
| Outside signers | Not yet implemented; existing signing links require the assigned account. |
| Multi-document / multi-recipient packets | Not yet implemented; existing NDA supports buyer and broker only. |
| Preparation | Optional non-identity fields, dropdown choices, text/email/number validation and non-signing buyer/broker previews implemented. Connected buyer/broker browser rehearsal passed on a production build against the isolated test database. |
| Request management | Decline reasons and paginated name search implemented; safe correction/reissue remains. |
| Evidence | Existing hashes, signatures, printable record and JSON export remain. Ed25519 export sealing and offline verifier implemented and unit-tested; secure key provisioning, publication and live verification remain. This is not a certificate-authority identity seal. |
| Operational proof | Local delivery failure/lease/quota checks added; independent review and real broker trials require other people. |

## No-cost constraint

No paid plans, credit cards or trial-only services are authorized. Resend's ongoing free plan is a candidate; OAuth signup was blocked by the security reviewer pending specific approval for read-only GitHub email-address access. No authorization workaround was attempted. Stripe Directory discovery failed with an invalid-user-agent error; no directory results were invented.

The proposed email worker reserves at most 90 first sends per UTC day and 2,700 per UTC month. Other uses of the same provider account count against the provider's own limits and must be budgeted separately. Nothing automatically upgrades the provider plan. The queue does not backfill historical notifications.

## Delivery safety

- No confidential document titles, contents or attachments in email.
- Existing assigned-account authentication is still required.
- Stable provider idempotency key per message; retry window stops before 24 hours.
- Sending is not the same as delivered. Callback signatures and timestamps are verified before delivery events are accepted. Duplicate events are idempotent; late delivery cannot clear a bounce or complaint.
- Atomic queue claims, bounded batches, leases, conservative quotas, stale-request cancellation.
- Outcome writes require the current lease ID; a stale worker cannot overwrite a replacement claim.
- Delivery disabled unless explicitly configured; no live customer email has been sent by these changes.

Run worker with an approved private environment using `node --import tsx scripts/process-signing-emails.mts`. Required variables: `SIGNING_EMAIL_ENABLED`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SIGNING_EMAIL_FROM`, `SIGNING_EMAIL_ORIGIN`. Values must not be committed.

## Migration gates

- 0057 is the email queue/callback schema. Keep the worker disabled until provider setup is complete. No historical backfill.
- 0058 permits explicit empty values only for newly configured optional fields. Old layouts remain required.
- 0059 records declines transactionally, preserving existing signatures and rejecting already-signed actors.
- Isolated testing received 0058 (asserted definition substitutions equivalent to the migration) and 0059. Production application and database release remain pending in this work log.

## Verification recorded so far

261 automated tests passed before adding the export-seal unit test; that additional test also passed. Type checking, scoped lint and production build passed. Runtime dependency audit: zero vulnerabilities. Connected browser rehearsal exposed a progress-state initialization issue, corrected before release. Development-mode PDF testing was blocked by the production security policy; testing returned to a production build without weakening the policy.

The connected two-party rehearsal now passes: saved eight-field layout, non-signing preview, optional blank value, dropdown choice, buyer drawn signature and broker uploaded signature, signing order, withdrawn/expired rejection, original/final hash checks, outsider denial, mobile/desktop overflow and automated accessibility. Both completed PDF pages were rendered and visually inspected. Page-transition readiness and stable dropdown accessible labels were corrected during the rehearsal. Synthetic accounts/documents were cleaned up. This is controlled testing, not a real broker trial.

Database tests also cover optional blank fields in buyer-first, broker-first and parallel orders. Email queue tests cover Spanish recipient preferences and deduplicated invitations for both parallel signers.

## Export seal operation

`SIGNING_EVIDENCE_PRIVATE_KEY` is a server-only Ed25519 PKCS8 PEM. Never commit it. `?format=sealed` requires the same assigned-participant authentication as other evidence downloads and returns 503 when unconfigured. The signature authenticates exact export bytes at export time, not an independently witnessed signing time. Preserve historical public keys and verify their fingerprints through a trusted channel. The standalone verifier intentionally requires a separately obtained trusted key rather than trusting a key bundled with an unknown document. Key rotation, protected backup and production configuration remain deployment gates.
