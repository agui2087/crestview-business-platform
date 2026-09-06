# Crestview transformation sequence

## Operating rule

Ship small, reversible increments. Every release must preserve working production flows, include an explicit test and rollback method, and keep verified facts separate from user submissions, calculations, and AI-generated content.

## Phase 0 — Immediate containment (1–2 days)

1. Disable the AI analysis route in production or put it behind a server-side feature flag
2. Add ownership/access checks, Pro entitlement enforcement, payload limits, throttling, usage logging, and a hard spend cap
3. Guarantee the local authentication fallback cannot run on a public production hostname
4. Add alerts for Stripe webhook failures and repeated authorization failures

Exit criteria: abuse tests pass; unauthorized calls receive 403; rate-limit tests receive 429; spend cannot exceed the configured cap.

## Phase 1 — Identity and authorization foundation (3–5 days)

1. Establish Supabase Auth UUID as the canonical user identifier
2. Replace the D1/email profile write path and migrate required profile data
3. Replace hard-coded admin email access with auditable roles/claims
4. Create a route-by-route authorization matrix for buyer, broker, brokerage admin, platform admin, and unauthenticated visitor
5. Add automated negative authorization tests

Exit criteria: one profile source; no email-keyed ownership; every protected action has an explicit policy and test.

## Phase 2 — Confidential document hardening (3–6 days)

1. Migrate document ownership to UUID
2. Add signature validation, quotas, throttling, retention/deletion rules, and malware scanning
3. Add download/upload/delete audit events and security alerts
4. Test cross-user and cross-deal access denial

Exit criteria: malicious and mislabeled files are rejected/quarantined; access isolation is proven; retention behavior is documented.

## Phase 3 — Critical journey test harness (4–7 days)

Automate desktop and mobile flows for account creation, buyer/broker role selection, listing creation, NDA delivery/signing state, financial-access approval, document exchange, buyer checklist, checkout, webhook/entitlement activation, portal access, cancellation, expiration, and recovery from failures.

Exit criteria: critical suite runs in CI and blocks releases; seeded test accounts/data are deterministic.

## Phase 4 — Product journey redesign (1–2 weeks)

1. Define shared tokens and components for typography, spacing, color, focus, forms, tables, cards, alerts, and empty/loading/error states
2. Map the buyer and broker journeys and reduce navigation duplication
3. Give every role-aware dashboard state one clear primary next action
4. Redesign dense deal rooms with a visible stage, owner, pending request, and next step
5. Complete responsive and accessibility QA

Exit criteria: persona usability tests complete the top tasks without assistance; WCAG 2.2 AA checks pass for critical journeys.

## Phase 5 — Reliability and operations (1 week)

Add structured logging, error monitoring, performance tracing, webhook and queue dashboards, service-level objectives, backup/restore validation, incident response, audit-log retention, and release rollback playbooks.

## Phase 6 — Marketplace quality and growth (ongoing)

Improve broker onboarding, listing-quality scoring, duplicate detection, availability confirmation, buyer-fit transparency, broker analytics, and trustworthy empty states. Licensed nationwide inventory and broker partnerships require separate commercial approval and should not be simulated as live data.

## Phase 7 — Workforce and real estate expansion (after core gates)

Workforce: define whether Crestview is a lightweight post-acquisition operating workspace or a regulated HR/payroll platform. Keep payroll, benefits, and legal compliance out of scope until specialists and vendors are engaged.

Real estate: validate target users and transaction model, then build property-specific underwriting, documents, roles, milestones, disclosures, and data integrations. Do not reuse business-acquisition calculations without validation.

