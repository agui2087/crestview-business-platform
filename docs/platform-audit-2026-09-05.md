# Crestview platform audit — September 5, 2026

## Executive assessment

Crestview has a credible production foundation: the public site, bilingual routing, authenticated dashboard, broker marketplace workflow, Stripe billing, private document vault, buyer diligence tools, workforce module, and real-estate preview are present and the production build succeeds. The platform is not yet enterprise-ready. The largest gaps are authorization and cost controls around AI, fragmented identity/data storage, thin automated coverage of critical journeys, incomplete document-security controls, and an empty live marketplace.

This audit intentionally precedes large architectural or business-model changes.

## Evidence reviewed

- Production public pages and authenticated broker dashboard at desktop and mobile widths
- Next.js routes, API handlers, authentication, Supabase migrations and row-level security policies
- Stripe entitlement and webhook implementation
- Private document storage implementation
- SEO metadata, robots and sitemap behavior
- Build, type check, lint and current automated tests

Baseline verification: production build, type check, lint, and all 8 existing tests passed.

## Critical findings

### C1 — AI endpoint lacks resource authorization, entitlement enforcement, and spend controls

`POST /api/ai/analyze` authenticates the caller but does not prove that the supplied opportunity belongs to or is accessible by that user. The supplied opportunity ID is not used, the model analyzes caller-provided facts, and there is no paid-entitlement check, rate limit, idempotency key, request budget, or usage ledger.

Impact: an authenticated user can create uncontrolled model spend and bypass the intended paid feature boundary. The endpoint should remain disabled in production until ownership, entitlement, throttling, size limits, audit logging, and a hard monthly budget are enforced.

### C2 — Critical buyer, broker, billing, and document journeys are not covered end to end

Only 8 automated tests exist. They cover selected calculations and helpers, not sign-up, role selection, listing creation, NDA delivery, financial-access approval, document access, checkout, webhook processing, entitlement changes, cancellation, or authorization failures.

Impact: regressions in revenue, privacy, or core user journeys can reach production undetected.

## High-priority findings

### H1 — Identity and profile data are split between Supabase and a Cloudflare/D1 path

The main application reads Supabase profiles keyed by immutable user UUIDs. The create-account action writes a separate D1/SQLite profile keyed by email. This creates two possible sources of truth and can produce incomplete onboarding, inconsistent roles/locales, and failures on deployments without the Cloudflare runtime.

Recommendation: make Supabase Auth plus `public.profiles.user_id` the single production identity/profile system; migrate any necessary D1 profile data and remove the parallel write path.

### H2 — Document vault controls are good at the database layer but incomplete at ingestion

The Supabase bucket is private, database tables use RLS/service-role access, files are size- and MIME-limited, and filenames are sanitized. However, ownership is tied to normalized email rather than immutable auth UUID; upload validation trusts declared MIME type; and there is no malware scan, per-user quota, rate limit, retention policy, or administrative incident workflow.

Recommendation: move ownership to user UUID, validate file signatures, add quotas and rate limits, define retention/deletion behavior, and add malware scanning before positioning the vault for sensitive financial documents at scale.

### H3 — Security headers are incomplete

The app sets frame, content-type, referrer, and permissions protections, but lacks a production Content Security Policy and HSTS. A formal dependency/security scan is not part of CI.

Recommendation: introduce CSP in report-only mode, fix violations, enforce it, add HSTS on the canonical domain, and add dependency scanning and secret detection to CI.

### H4 — Administrator authorization is hard-coded to one email

The admin page grants access by comparing the current email to a source-code literal. This is brittle, hard to audit, and not appropriate for delegated operations.

Recommendation: use a server-enforced admin role/claim with an auditable grant and revocation process, plus step-up authentication for sensitive actions.

### H5 — Live marketplace supply is empty

The live public listing search currently returns zero opportunities. The workflow can be demonstrated with broker-created data, but the core discovery promise is not yet useful to an ordinary buyer without supply.

Recommendation: keep data acquisition and broker partnerships as a separate go-to-market workstream; improve honest empty states and seeded demonstration environments without presenting demo listings as live inventory.

## Medium-priority findings

- The local-development authentication fallback stores unsigned JSON in a cookie when Supabase is not configured. It must be impossible to enable on a public production deployment.
- Several authenticated pages use generic metadata. Dashboards are correctly excluded from indexing, but page titles should still identify the current workspace for usability.
- The sitemap assigns a fresh modification date broadly, which can imply pages changed when they did not. Use actual content/deployment dates.
- The live mobile dashboard rendered cleanly at 390 × 844, but full mobile checks are still needed for modals, tables, uploads, billing, error states, and long localized content.
- Accessibility needs automated axe coverage plus keyboard, focus, zoom, reduced-motion, and screen-reader checks across every critical journey.
- Observability is not enterprise-grade: define error tracking, structured security events, webhook alarms, performance objectives, and an incident runbook.
- Workforce is an early operational module, not a complete HRIS/payroll product. Real estate is appropriately labeled as a preview and should not inherit business-acquisition assumptions without domain-specific validation.

## Product and UX assessment

The refreshed visual direction is distinctive and stronger than the previous generic dashboard treatment. The next design pass should prioritize journey clarity over more decoration: one primary action per state, role-aware navigation, progressive disclosure, explicit status and ownership, consistent empty/loading/error states, and a persistent indication of the next required step.

The public acquisition story is understandable. The authenticated product needs systematic validation for four personas: first-time buyer, experienced buyer, solo broker, and brokerage team administrator.

## Release gates

No enterprise claim or broad paid launch should occur until:

1. C1 is remediated and verified with abuse tests
2. The single identity/profile source is established
3. End-to-end tests cover the revenue and confidential-document paths
4. Upload security and access-control tests pass
5. Billing/webhook alerts and rollback procedures are operational
6. At least one complete buyer and broker usability study is completed on desktop and mobile

