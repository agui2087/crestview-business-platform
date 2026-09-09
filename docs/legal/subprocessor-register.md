# Subprocessor register — DRAFT FOR CONTRACT/PRIVACY REVIEW

Confirm the contracting entity, service region, data-processing addendum, security terms, retention, deletion, and cross-border mechanism before marking a provider active.

| Provider | Purpose | Data categories | Status / required review |
| --- | --- | --- | --- |
| Vercel | Production web hosting/functions/logs | Requests, account/workspace data processed by functions, redacted diagnostics | Appears in application deployment architecture; Geo must confirm account, regions, retention, DPA |
| Supabase | Authentication, Postgres database, private object storage, backups | Accounts, roles, listings, workflows, uploaded documents, pilot data | Appears in production code; Geo must confirm project, region, plan, backup/PITR, log/storage retention, DPA |
| Stripe | Checkout, billing portal, subscription/payment events | Customer/billing identifiers, payment status; payment credentials remain with Stripe | Appears in production code; Geo must confirm enabled products, account entity, retention, DPA |
| GitHub | Source control, CI, monitor/backup workflow artifacts and incident tickets | Source, redacted operational status, encrypted backups if workflow enabled | Repository workflows prepared; Geo must approve secrets, artifact access/retention, DPA/organization controls |
| Cloudmersive | Managed malware scanning of uploaded files | Complete uploaded file bytes and scan metadata | **Not active until** privacy/security/contract/region review and Geo adds sensitive production key |
| Incident webhook provider | Delivery of redacted error events | Event type, route, environment, request ID, sanitized error details | **Not selected/configured**; document provider and review before adding URL/token |
| OpenAI | Server-side analysis features where enabled | User-submitted opportunity facts and analysis prompts, subject to endpoint controls | Code contains optional integration; confirm whether production-enabled, contract, retention, and disclosure |

Do not list a service as an active subprocessor solely because its library exists in the repository. Update users before a new subprocessor where law/contract requires it.
