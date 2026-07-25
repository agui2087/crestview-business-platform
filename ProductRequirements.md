# Product Requirements

## 1. Product Vision

Build an operating system for small-business ownership that helps entrepreneurs acquire, operate, understand, and grow businesses. The platform will eventually cover the business lifecycle from opportunity discovery through workforce operations, but delivery begins with a focused, testable product.

## 2. Product Strategy

The platform contains two products on a shared foundation:

1. **DealFlow AI** helps acquisition entrepreneurs turn fragmented opportunity data into a transparent, prioritized acquisition pipeline.
2. **Workforce Platform** helps small-business owners organize employee records and administrative workflows in English and Spanish.

The recommended first commercial wedge is DealFlow AI. Workforce functionality should follow only after the shared platform and DealFlow workflow are validated. Building both simultaneously would dilute discovery, security review, and product quality.

## 3. Target Users

### DealFlow AI

- Search-fund entrepreneurs
- Owner-operators
- Acquisition entrepreneurs
- Independent sponsors
- Small-business investors

Primary initial persona: an acquisition entrepreneur evaluating businesses priced approximately $100,000–$10,000,000 who currently manages listings in browser tabs, spreadsheets, email, and notes.

### Workforce Platform

- Small-business owners
- Operations/HR administrators
- Managers
- Employees, including Spanish-preferring employees

## 4. User Problems

### DealFlow

- Listings are fragmented and inconsistent.
- The same opportunity appears in multiple places.
- Financial terms and missing fields are difficult to compare.
- Screening criteria live in spreadsheets or memory.
- Generic AI summaries can obscure unsupported assumptions.
- Pipeline history and diligence work become disconnected.

### Workforce

- Employee information and documents live in disconnected files.
- Expirations, training, PTO, and announcements lack visibility.
- Enterprise HR systems are too complex or expensive.
- English-only interfaces create administrative friction.

## 5. Product Principles

- **Evidence before inference:** source facts and AI analysis are visibly distinct.
- **Explainability:** scores show factor contributions, missing information, and methodology version.
- **Human control:** AI drafts and recommends; users approve consequential actions.
- **Simple before comprehensive:** prioritize the core job over feature breadth.
- **Secure by default:** tenant isolation and least privilege are release requirements.
- **Bilingual by design:** locale is user-specific and content is translation-ready.
- **Accessible:** target WCAG 2.2 AA for core workflows.

## 6. MVP Definition

### 6.1 Foundation MVP

An invited user can:

- authenticate securely;
- create or join an organization;
- switch between authorized organizations;
- use an English or Spanish interface shell;
- view a role-appropriate dashboard;
- manage basic profile and notification preferences;
- invite and manage organization members within permitted roles.

Administrators can audit important organization and permission changes.

### 6.2 DealFlow AI MVP

An authorized user can:

- import an opportunity manually or from one approved data source;
- search and filter normalized opportunities;
- see original source facts and field provenance;
- save an opportunity;
- request structured AI analysis;
- see a transparent 0–100 score, factor contributions, missing information, confidence, and methodology version;
- add the opportunity to a pipeline;
- move a deal through stages;
- assign an owner, add notes/tasks, and view stage history.

### 6.3 Explicit MVP exclusions

- broad web scraping;
- autonomous outbound messages;
- offer or legal-document generation;
- automated valuation presented as professional advice;
- advanced due-diligence room;
- multi-opportunity modeling;
- billing collection until entitlement needs are validated;
- Workforce product workflows;
- payroll processing;
- native mobile apps.

## 7. Core User Journeys and Acceptance Criteria

### Journey A: Organization onboarding

1. User signs in.
2. User creates an organization or accepts an invite.
3. User selects locale and time zone.
4. User lands on the organization dashboard.

Acceptance criteria:

- a user cannot access an organization without active membership;
- switching tenants cannot leak cached or server-rendered data;
- invites expire and cannot be replayed;
- permissions are enforced server-side and through RLS;
- interface locale persists per user.

### Journey B: Opportunity ingestion

1. User creates/imports an opportunity.
2. System stores original source evidence.
3. System normalizes supported fields.
4. System records provenance and flags missing data.
5. Potential duplicates are identified for review.

Acceptance criteria:

- source evidence is not overwritten;
- normalization records method/version;
- unknown financial data remains null;
- duplicates are not silently merged;
- unsupported or failed inputs have a clear status and recovery path.

### Journey C: Search and screening

1. User applies structured filters or a supported natural-language query.
2. System returns authorized, normalized opportunities.
3. User sees active filters and result counts.
4. User saves a search or opportunity.

Acceptance criteria:

- structured filters produce deterministic results;
- natural-language parsing shows the interpreted filters for confirmation;
- empty and missing values are distinguishable;
- pagination and sorting are stable;
- search never crosses organization/data-entitlement boundaries.

### Journey D: AI analysis and score

1. User requests analysis.
2. System snapshots authorized input and creates an asynchronous run.
3. Validated analysis and deterministic score are stored.
4. User sees evidence, assumptions, missing information, confidence, and version.

Acceptance criteria:

- output is labeled AI-generated;
- claims cite source fields where possible;
- inferred items are labeled as inference;
- score factor contributions reconcile to the displayed score;
- a failed run does not erase an earlier valid result;
- regenerated output creates a new version;
- unsafe source instructions do not gain tool or system authority.

### Journey E: Pipeline tracking

1. User adds an opportunity to a pipeline.
2. User assigns an owner and stage.
3. User adds notes and tasks.
4. User moves the deal.
5. System records history.

Acceptance criteria:

- only authorized users can view or mutate a deal;
- stage transitions are auditable;
- concurrent updates fail safely or show a conflict;
- archived deals remain recoverable according to policy.

## 8. Explainable Scoring Requirements

Initial candidate factors:

- cash flow quality;
- revenue quality and stability;
- EBITDA quality;
- seller financing;
- business age;
- industry attractiveness;
- growth potential;
- operational complexity;
- customer concentration;
- owner dependency;
- earnings quality;
- price relative to earnings;
- data quality.

Before release, a domain expert must define each factor, accepted inputs, normalization method, weight, missing-data behavior, evidence requirements, and score bands.

The score must:

- be reproducible from a frozen input snapshot and methodology version;
- avoid treating missing information as a negative zero unless the methodology explicitly assigns an uncertainty penalty;
- show positive factors, negative factors, missing information, reasoning, and confidence;
- avoid claims of investment suitability or guaranteed outcomes;
- support side-by-side comparison only when methodology versions match or differences are disclosed.

## 9. Workforce Phase Requirements

An authorized workforce administrator will be able to manage:

- employee profiles and employment history;
- departments and managers;
- compensation records with restricted access;
- documents and acknowledgments;
- certifications and expirations;
- training assignments/completions;
- PTO policies, ledger-backed balances, and requests;
- bilingual announcements and basic reports.

Employees will have limited self-service access in their chosen locale. Managers see only permitted reports. Payroll calculation, tax filing, payment initiation, and benefits administration remain excluded until a separate compliance and integration strategy is approved.

## 10. Localization Requirements

- English and Spanish interface catalogs from the foundation phase.
- User-level locale independent of organization default.
- Locale-aware dates, currency, numbers, pluralization, and time zones.
- No concatenated sentence fragments that translators cannot reorder.
- Translation completeness checks in CI.
- Spanish review by a qualified human before production release.
- AI-translated user content is optional, clearly labeled, and never overwrites the original.

## 11. Security, Privacy, and Compliance Requirements

Release-blocking requirements:

- tenant isolation tests pass;
- RLS exists on tenant tables;
- protected actions verify session, membership, and permission;
- service keys and AI keys never reach the browser;
- uploads use private storage, type/size checks, scanning, and signed access;
- sensitive workforce and financial fields are excluded from analytics/logs;
- audit events cover access-control and high-risk data changes;
- rate limits and abuse controls protect authentication, imports, exports, and AI;
- deletion/export flows and retention rules are documented;
- dependency and secret scans run in CI.

Legal review is required for data-source licenses, privacy disclosures, AI disclaimers, employment-data obligations, and any claims about acquisition quality.

## 12. Non-Functional Requirements

Initial targets, to be measured and revised:

- core pages usable on current desktop and mobile browsers;
- p95 server response under 500 ms for ordinary indexed reads, excluding external/AI work;
- user feedback within 200 ms for initiated interactions;
- AI/import work executes asynchronously with visible status;
- core workflows meet WCAG 2.2 AA;
- no cross-tenant data exposure in automated tests;
- restore procedure tested before production launch;
- structured error messages provide recovery without leaking internals.

## 13. MVP Success Measures

Product:

- median time from opportunity import to reviewed score;
- percentage of opportunities with usable normalized data;
- weekly saved/evaluated opportunities per active organization;
- pipeline adoption and repeat weekly use;
- user-rated usefulness and trust of analysis;
- percentage of AI claims backed by valid citations;
- conversion from pilot to paid intent.

Quality:

- cross-tenant authorization failures: zero;
- normalized-field provenance coverage;
- score reproducibility rate;
- AI structured-output validation pass rate;
- duplicate detection precision/recall on a reviewed sample;
- job failure and retry rates;
- cost per analyzed opportunity.

## 14. Assumptions

- Initial customers accept an invitation-only web product.
- One approved listing source or manual import is sufficient to validate the workflow.
- A domain expert will approve the scoring model.
- Supabase and Vercel fit early-stage scale and budget.
- English and Spanish are the only launch locales.
- Users understand the platform does not provide legal, tax, payroll, or investment advice.

## 15. Key Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Data-source terms prohibit collection/use | Blocks discovery value | Obtain written rights; start with user-provided/manual data |
| Inconsistent listing data | Misleading rankings | Provenance, null semantics, confidence, user correction |
| AI hallucination/prompt injection | Loss of trust/security | Structured outputs, citations, untrusted-content isolation, evaluations |
| Arbitrary scoring | Poor decisions and liability | Expert-owned versioned methodology and deterministic calculation |
| Cross-tenant access bug | Severe privacy incident | RLS, server checks, automated isolation tests |
| Workforce sensitivity | Legal/reputation risk | Separate permissions, minimization, retention/legal review |
| Product scope too broad | Delayed validation | DealFlow wedge, explicit exclusions, milestone gates |
| Serverless job limits | Failed ingestion/AI tasks | Durable queue and idempotent workers |
| Vendor dependency/cost | Margin or migration pressure | Provider abstraction at boundaries, usage/cost tracking |
| Spanish quality issues | Confusion or harm | Professional review and locale QA |

## 16. Discovery Questions

Before implementation, the founder and product lead should answer:

1. Who are the first five design partners?
2. Which single source/import method will power the MVP?
3. What task do users perform today, and what would make them switch?
4. Which fields are essential for an initial screening decision?
5. Who is qualified to own and approve the scoring methodology?
6. What actions must never be automated?
7. Which countries/states will the product serve initially?
8. What data retention and deletion promises will customers receive?

