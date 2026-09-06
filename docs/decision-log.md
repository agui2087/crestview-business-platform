# Crestview decision log

## 2026-09-05 — Audit before transformation

Decision: complete and present a production/code audit before large architectural or business-model changes.

Reason: the requested enterprise transformation includes security, billing, confidential documents, AI spend, multiple product lines, and production users. Safe sequencing requires verified baseline risks and release gates.

## 2026-09-05 — Preserve existing homepage change

Decision: do not overwrite the existing uncommitted modification in `app/[locale]/page.tsx`.

Reason: it is pre-existing user work and is unrelated to the audit documentation.

## 2026-09-05 — Canonical identity direction

Proposed decision: use Supabase Auth user UUID plus `public.profiles` as the canonical production identity/profile source; retire the separate email-keyed D1 profile path after migration review.

Status: recommended, not yet implemented.

## 2026-09-05 — AI availability

Proposed decision: keep AI analysis unavailable to production users until resource authorization, entitlement, rate limiting, usage accounting, and a hard spend ceiling are implemented and tested.

Status: urgent recommendation, not yet implemented.

Implementation update: the production route now fails closed behind `CRESTVIEW_AI_ANALYSIS_ENABLED`, enforces a 50 KB fact payload, and reserves authorized usage atomically through migration `0019_ai_analysis_controls.sql`. The reservation requires a saved opportunity, an active Crestview Pro entitlement, and hourly/daily limits. Activation remains intentionally off until the migration is applied and validation passes.

## 2026-09-05 — Production local-authentication fallback

Decision: local cookie authentication is permitted only in non-production environments and only when `CRESTVIEW_ENABLE_LOCAL_AUTH=true` is explicitly set.

Reason: a missing Supabase configuration must fail closed on a public deployment.

## 2026-09-05 — Expansion sequencing

Decision: stabilize the business-acquisition product before expanding Workforce or Real Estate into regulated or transaction-critical functionality.

Reason: a shared design system can span products, but domain workflows and compliance cannot safely be copied without validation.

## 2026-09-06 — Platform administrator authorization

Decision: replace application-level email matching with the database-backed `platform_administrators` role. Migration `0020` preserves the original owner's access once, while future grants and revocations require an active administrator.

Reason: email is a mutable communication attribute and should not be an authorization key. Database roles provide a central and auditable source of truth.

## 2026-09-06 — One production identity system

Decision: retire the legacy ChatGPT-hosted profile write to Cloudflare D1. Standalone Crestview accounts continue to use Supabase Auth and `public.profiles`; legacy embedded account entry now hands users off to the canonical Crestview sign-in.

Reason: maintaining two email- and UUID-keyed profile stores creates inconsistent roles, preferences, and ownership. One canonical identity prevents users from receiving different account state depending on where they entered the product.

## 2026-09-06 — Document content validation

Decision: validate file signatures in addition to browser-supplied MIME types before storing uploads or replacements.

Reason: a filename extension and MIME label can be forged. Signature checks reject common renamed or malformed files before they enter the confidential document vault; malware scanning remains a separate production gate.
