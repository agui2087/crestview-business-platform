# Development Plan

## 1. Delivery Approach

Build in small, releasable vertical slices. Each milestone ends with working software, automated checks, documentation, and a go/no-go decision. The plan deliberately does not start application implementation until the architecture questions and data-source constraints below are resolved.

## 2. Current Constraints

- The repository is only a Next.js starter.
- Supabase, OpenAI, testing, CI, monitoring, billing, and localization are not installed.
- Next.js 16.2.11 has version-specific breaking changes; its bundled documentation must be consulted before implementation.
- Node.js 24 is installed locally. Hosting/build runtime compatibility must be confirmed and pinned in the repository.
- Opportunity-source licensing and access are unknown.
- Scoring weights and definitions have not been approved by a domain expert.
- Applicable workforce privacy/employment jurisdictions are unknown.
- There is no production domain, Vercel project, Supabase project, or environment strategy yet.

## 3. Decision Gates Before Code

### Gate A: Product focus

Approve:

- first customer persona;
- first high-value DealFlow workflow;
- MVP exclusions;
- pilot success metrics.

### Gate B: Data rights

Approve one ingestion path:

- user-entered opportunities;
- CSV import;
- contracted provider API;
- another source with documented permission.

No scraping connector should be built until terms, robots restrictions where relevant, privacy, retention, and commercial use are reviewed.

### Gate C: Scoring governance

A qualified acquisition practitioner approves:

- factor definitions;
- weights and thresholds;
- missing-data treatment;
- evidence requirements;
- score interpretation and disclaimers;
- evaluation dataset and acceptance threshold.

### Gate D: Security and privacy

Approve:

- launch jurisdictions;
- data classification;
- retention/deletion rules;
- organization roles;
- incident owner;
- vendor/data-processing review.

## 4. Milestone Roadmap

### Milestone 0 — Architecture and discovery

Deliverables:

- architecture, schema, requirements, development, and API documents;
- design-partner interview guide;
- data-source feasibility decision;
- initial scoring specification;
- threat model and data-classification worksheet;
- prioritized product backlog.

Exit criteria:

- Gates A–D have owners and documented decisions;
- a narrow MVP journey is approved;
- no unresolved blocker invalidates the chosen data model.

### Milestone 1 — Engineering foundation

Deliverables:

- pinned runtime and package-manager policy;
- environment-variable validation and example file with placeholders only;
- Supabase local/dev setup and migration workflow;
- automated formatting, lint, type-check, unit, integration, and end-to-end test commands;
- CI checks and preview deployments;
- error monitoring, structured logging, and correlation IDs;
- base UI tokens and accessible component conventions;
- English/Spanish localization framework;
- security headers and baseline dependency/secret scanning.

Exit criteria:

- clean checkout can be set up from documentation;
- CI passes;
- preview uses non-production data;
- no secrets are committed;
- a sample locale switch and health check work;
- initial threat model has no unowned critical risks.

### Milestone 2 — Identity and multi-tenant foundation

Deliverables:

- authentication;
- profile and organization creation;
- invitations and memberships;
- role/permission policy layer;
- RLS policies;
- organization switcher;
- basic dashboard shell;
- audit log for membership and role changes.

Exit criteria:

- automated tests prove users cannot cross tenant boundaries;
- invite expiry/replay and role-escalation cases are tested;
- protected server operations enforce authorization;
- accessibility review passes core onboarding.

### Milestone 3 — Opportunity system of record

Deliverables:

- manual entry plus the approved ingestion method;
- immutable source snapshots;
- normalized opportunity fields and provenance;
- missing-data handling;
- duplicate-candidate workflow;
- opportunity list/detail/search/filter;
- save opportunity and saved search.

Exit criteria:

- normalization fixtures pass;
- source evidence is visible and immutable;
- unknown is distinguishable from zero;
- duplicate merges require traceable review;
- search results are stable, paginated, and tenant-safe.

### Milestone 4 — Explainable analysis and scoring

Deliverables:

- durable job execution;
- prompt/version registry;
- structured AI analysis;
- deterministic, versioned scoring engine;
- factor-level evidence and confidence;
- failure/retry/status UX;
- AI evaluation suite and cost/latency telemetry.

Exit criteria:

- score reproduces from its input/methodology snapshot;
- factor contributions reconcile to the total;
- structured outputs meet the validation threshold;
- prompt-injection test corpus does not cause unauthorized actions;
- citations and source-vs-inference labels pass human review;
- cost per opportunity is within an approved limit.

### Milestone 5 — Acquisition pipeline MVP

Deliverables:

- configurable pipeline/stages;
- deal owner, notes, and tasks;
- stage-history audit;
- dashboard for active deals and follow-ups;
- CSV export with permission and audit controls.

Exit criteria:

- pilot users can complete import-to-pipeline workflow unaided;
- concurrency and stage-history tests pass;
- exports are permissioned, rate-limited, and audited;
- pilot metrics are instrumented.

### Milestone 6 — Private pilot and hardening

Deliverables:

- onboarding for a small design-partner cohort;
- support and incident process;
- backup/restore test;
- performance and accessibility review;
- privacy and terms documents reviewed by counsel;
- remediation of pilot feedback and security findings.

Exit criteria:

- no open critical/high security findings;
- restore exercise succeeds;
- retention/deletion flow is verified;
- product success thresholds justify expansion.

### Milestone 7 — DealFlow expansion

Candidate scope, selected from evidence:

- comparisons;
- due-diligence checklists and document rooms;
- broker-contact drafting with mandatory human approval;
- advanced search connectors;
- offer-preparation workspace;
- billing and entitlements.

### Milestone 8 — Workforce foundation and MVP

Before starting, run a fresh legal/privacy/security design review. Then deliver employee records, restricted compensation history, documents, certifications, training, PTO, announcements, Spanish localization, and reporting. Payroll processing remains outside scope.

## 5. Workstreams

### Product and design

- conduct user interviews and workflow observation;
- prototype critical screens before implementation;
- maintain acceptance criteria and an explicit non-goal list;
- test English and Spanish usability;
- include accessibility in design review.

### Data and AI

- define data contracts per source;
- create normalization and deduplication fixtures;
- build a reviewed benchmark dataset;
- version prompts, schemas, models, and scoring;
- measure groundedness, citation validity, missing-data recognition, and injection resistance;
- add cost and latency budgets.

### Security

- threat-model auth, tenancy, uploads, external sources, AI, webhooks, exports, and workforce data;
- test RLS separately from application authorization;
- review dependencies and secrets;
- establish incident, backup, retention, and deletion procedures;
- perform an independent security review before public launch.

### Operations

- define environment ownership;
- configure monitoring and alert routes;
- document release, rollback, migration, and incident runbooks;
- define support response and provider outage behavior.

## 6. Testing Strategy

### Unit tests

- scoring calculations and missing-data policy;
- permission decisions;
- normalization functions;
- locale formatting and validation schemas.

### Integration tests

- database constraints and RLS;
- organization membership boundaries;
- source-to-normalized provenance;
- job idempotency and retries;
- storage authorization;
- webhook signature and replay handling.

### End-to-end tests

- onboarding and invitation;
- tenant switching;
- opportunity import/search/save;
- analysis/score review;
- pipeline transitions;
- English/Spanish navigation;
- keyboard and screen-reader-critical paths.

### AI evaluations

- citation correctness;
- hallucination/unsupported-claim rate;
- missing-information recall;
- source/inference classification;
- structured-output validity;
- prompt-injection resistance;
- consistency across an approved benchmark.

AI evaluations should run on prompt/model changes and on a scheduled basis. A model change is a product change, not a silent dependency update.

## 7. Definition of Done

A feature is done only when:

- acceptance criteria pass;
- server authorization and RLS are implemented and tested;
- inputs and outputs are schema-validated;
- failure, loading, empty, and retry states exist;
- English and Spanish keys are present;
- accessibility checks pass;
- audit/metrics/logging requirements are met without leaking sensitive data;
- tests and documentation are updated;
- migrations are reviewed and rollback/forward-fix implications understood;
- no secrets or production data are committed.

## 8. Release Strategy

- Use short-lived branches and pull requests.
- Every pull request receives automated preview deployment against non-production services.
- Use feature flags for incomplete or high-risk capabilities.
- Release schema changes before code that requires them; remove old fields later.
- Start with an invitation-only pilot.
- Expand cohort size only after reliability, security, usefulness, and cost gates pass.

## 9. Risks and Mitigation Owners

| Risk | Primary owner | Near-term action |
|---|---|---|
| Unlicensed opportunity data | Founder/legal | Select and document MVP ingestion right |
| Invalid scoring model | Product/domain expert | Write and approve methodology v1 |
| Tenant data leak | Engineering/security | Threat model and RLS test harness |
| AI trust failure | AI/product | Build benchmark and groundedness criteria |
| Scope expansion | Founder/product | Approve MVP exclusions and milestone gates |
| Workforce compliance | Legal/security | Delay product data collection pending review |
| Job/runtime mismatch | Engineering | Prototype durable job runner |
| Vendor cost/lock-in | Engineering/finance | Set usage telemetry and cost thresholds |
| Poor Spanish quality | Product/localization | Engage qualified reviewer |

## 10. Immediate Next Actions

These are planning actions, not authorization to begin application code:

1. Interview five target acquisition entrepreneurs.
2. Choose the first ingestion method and document data rights.
3. Draft scoring methodology v1 with a qualified domain expert.
4. Complete data classification and threat-model workshops.
5. Choose authentication methods and initial roles.
6. Decide supported launch jurisdictions.
7. Confirm Node/Vercel runtime compatibility and pin the runtime.
8. Review the relevant bundled Next.js 16 documentation.
9. Convert Milestones 1–5 into prioritized, acceptance-tested tickets.
10. Begin implementation only after the decision gates are approved.

