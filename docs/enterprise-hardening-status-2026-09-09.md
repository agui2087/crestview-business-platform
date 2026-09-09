# Crestview enterprise-hardening status — 2026-09-09

This document is the release record for the hardening phase. “Implemented” means the repository contains the control and local verification can run without production credentials. “Pending external action” means no secret, legal conclusion, vendor approval, or participant result has been assumed.

## Implemented in the application

- Structured, redacted operational events for server, authentication, Stripe, document upload, scanner, and pilot-feedback failures
- Optional HTTPS incident delivery through `CRESTVIEW_ALERT_WEBHOOK_URL`; alert delivery cannot break the customer operation
- Production health monitor and GitHub incident lifecycle workflow
- Encrypted database/object-storage backup workflow with an isolated restore verification stage
- Managed Cloudmersive scan path for vault files, listing NDAs, and deal-room files; provider failures fail closed
- Keyboard skip navigation, visible focus handling, current-page semantics, mobile navigation labels, live upload status, and accessible file controls
- Desktop/mobile automated WCAG 2.2 A/AA release checks
- Repeatable public and authenticated load scenarios with explicit p95/error-rate budgets; upload writes are restricted to staging and cleaned up
- First-party, authenticated pilot journey events and a private feedback form with data minimization and retention rules
- Legal/privacy drafts, retention/deletion schedule, subprocessor register, pilot plan, and independent-review preparation

## Verified in this work session

- Type checking, linting, 23 unit/security tests, and the optimized production build passed
- 27 desktop/mobile browser tests passed, including automated WCAG 2.2 A/AA checks, responsive overflow, skip navigation, and mobile keyboard navigation; one desktop-inapplicable mobile-menu case was skipped
- A 260-request public production baseline had zero HTTP errors. Homepage, listings, and listing search passed. The health probe failed its 750 ms p95 budget at 1,945 ms; an experimental query optimization was reverted after a production timeout, so Supabase-path profiling and a production retest remain required
- No credentialed restore, Cloudmersive, authenticated load, or document-upload load test was represented as complete

## Required before calling the controls production-active

| Owner | Required action | Completion evidence |
| --- | --- | --- |
| Geo / Vercel administrator | Add `CRESTVIEW_ALERT_WEBHOOK_URL` and optional token to Production only; redeploy | Deliberate test error appears once in the approved incident receiver and contains no PII |
| Geo / GitHub administrator | Confirm scheduled workflow is enabled for the production repository | Two monitor cycles pass; a controlled failure opens and recovery closes the test incident |
| Geo / Supabase administrator | Confirm managed database backup/PITR retention for the paid plan | Dated dashboard screenshot or exported configuration in the private operations record |
| Geo / GitHub administrator | Add backup secrets and manually run the restore drill | Successful workflow artifact plus completed restore record; never commit values |
| Geo / vendor owner | Complete Cloudmersive privacy/security review and add the API key as a sensitive Production secret | Clean file accepted, EICAR test file rejected, provider-unavailable simulation rejected, all visible in redacted logs |
| Geo / staging administrator | Supply an isolated staging origin and test-user session to the manual load workflow | JSON result passes every budget, including temporary upload-and-delete |
| Attorney / privacy counsel | Approve or revise all documents under `docs/legal/` | Dated written approval and final policy publication |
| Pilot owner | Recruit consenting buyers/brokers and run the pilot checklist | Participant roster stored outside product logs, feedback triage, and exit decision |
| Independent assessor | Set scope and perform the penetration test after the above gates | Signed report, remediation register, retest evidence |

## Claims that are not yet permitted

- Do not say “enterprise-grade,” “independently penetration tested,” “SOC 2 compliant,” “HIPAA compliant,” or “malware-free.”
- Do not state that Cloudmersive scanning, automated restore verification, production paging, or point-in-time recovery is active until the corresponding evidence above exists.
- Do not state that deleting a database record instantly erases every encrypted backup copy; use the approved retention language instead.
