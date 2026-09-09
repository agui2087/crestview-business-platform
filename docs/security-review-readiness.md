# Independent security review readiness

## Recommended scope

Include the public application, authenticated buyer/broker/admin roles, Supabase Auth/Postgres/RLS/Storage, document upload/download/replacement/deletion, Cloudmersive transfer, Stripe checkout/portal/webhooks, pilot feedback, Vercel deployment controls, GitHub Actions, secrets, and recovery procedures.

## Assessor prerequisites

- Written authorization, test dates, source IPs, emergency contacts, and safe-stop conditions
- Isolated staging environment with production-equivalent controls and synthetic data
- Test accounts for buyer, broker, workforce, advisor, and administrator; no shared credentials
- Architecture/data-flow diagram, authorization matrix, migrations, dependency inventory, API inventory, and release SHA
- Explicit exclusion of denial-of-service, destructive production writes, real malware outside the approved EICAR test, social engineering, and third-party vendor testing unless separately authorized

## High-priority test cases

- Broken object-level authorization across every UUID/path and role transition
- RLS bypass, service-role exposure, insecure direct storage access, and signed-URL lifetime
- Upload content/type confusion, archive/polyglot/active-document handling, scanner outage and timeout behavior
- CSRF/origin validation for state-changing actions; session fixation, logout, reset, and privilege elevation
- Stripe price manipulation, replay/idempotency, forged signatures, entitlement drift, and portal ownership
- Stored/reflected injection in listings, messages, names, feedback, and generated analysis
- Rate limits and resource exhaustion for auth, AI, search, messages, uploads, and webhooks
- Secrets in builds, logs, source maps, workflow artifacts, backups, and error alerts
- Backup confidentiality, restore authorization, recovery completeness, and deletion behavior

## Internal remediation already represented in the repository

Security headers, server-only credentials, signed private storage access, RLS tightening, step-up administrative controls, upload quotas and lifecycle cleanup, fail-closed scanning, event redaction, webhook idempotency, safe origin validation, production monitoring, and automated quality/security gates.

## Finding workflow

Track ID, severity/CVSS, affected asset, exploit evidence, data impact, owner, target date, fix SHA, test evidence, and assessor retest status. P0/Critical pauses the pilot/release immediately; High requires fix before launch; Medium requires an accepted deadline; Low may enter backlog. Do not publish exploit details or customer data in a public issue.

An independent test is pending. Passing internal tests is not a substitute, and Crestview must not market itself as independently tested until the assessor has retested all Critical/High findings.
