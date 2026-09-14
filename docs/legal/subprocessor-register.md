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
| OpenAI | Not used by the current private-document analysis flow | No private-document transfer through that flow | Current app/lib review found no hosted OpenAI calls. An installed SDK alone does not establish active processing. Re-review before introducing any hosted integration. |

Private analysis also runs on Crestview-controlled equipment with a local model. Treat that equipment as an internal processing asset, not an external subprocessor. Record its custodian, location, disk/access protections, incident response and deletion controls separately. The model is loopback-only with cloud use disabled; this does not change the hosting/storage providers involved in the upload path.

Do not list a service as an active subprocessor solely because its library exists in the repository. Update users before a new subprocessor where law/contract requires it.
