# Inclusive broker and buyer roadmap

Requested: all 25 workstreams plus a broker profile section. No workstream is complete merely because a page exists. Each needs implementation review, authorization tests, relevant browser rehearsal and verified production deployment. Human validation and independent reviews must not be represented as software deliverables.

## Added priority: broker profiles
PR 96 implemented separate public-safe data, draft/publish controls, broker-only editing, public directory and profile, specialities/areas/languages/approach and welcome for preparing buyers. No automatic publication of account contact data, claims of verified credentials, fabricated reviews or deal counts. Migrations 0061/0062 applied to isolated and production databases; production row-level security and verification triggers checked. Connected synthetic rehearsal passed, including draft privacy, publish/unpublish, unauthorized edits, mobile/desktop, EN/ES and automated accessibility. CI passed 269 tests, 87 browser checks (3 skipped) and 10 purchase-navigation checks. Production deployment is separately verified in the release report.

## Workstream ledger
| # | Workstream | Current evidence / remaining work |
|---|---|---|
|1|Existing feature audit|Started. Buyer settings already include preferences, funding, summary and financial-sharing controls. Continue full inventory.|
|2|Welcoming buyer paths|Private preparing/actively searching choice and welcoming marketplace copy added. Both paths retain access; tailored guidance and relevant next-step links added in the follow-up batch.|
|3|Reusable buyer profile|Account-profile validation and optional organization/contact values shipped. Follow-up adds strict buyer-preference validation, atomic self-only saves, zero/blank financial inputs, price-range checks and preservation of the explicitly chosen budget. Unit/database tests and connected browser save/reload passed; release tracked separately.|
|4|Readiness checklist|Private reversible eight-step preparation checklist, progress and next step added. No readiness/rejection score or proof-of-funds gate. Further contextual education remains.|
|5|Financial readiness/privacy|Self-asserted verified-account/funds claims blocked at database level. Inbox labels no longer imply proof or lender approval. Evidence provenance and expiry remain.|
|6|Financing preparation|Existing financial scenarios; audit assumptions and lender-preparation workflow.|
|7|Listing clarity|Added explicit period, actual/projected/mixed classification, cash-flow basis and public explanation. Unknowns remain unknown; unsupported verified-financial marketing removed. Database constraints and isolated browser save/reload/public display passed. Included assets and correction-history audit remain.|
|8|Inquiry types|Separate public-question action added without financial declarations, automatic NDA delivery or confidential access. Transactional message/notification, duplicate retry protection, bounded submissions and closed-conversation protection. Connected buyer/broker rehearsal passed; release tracked separately. Existing NDA path remains.|
|9|Broker pipeline|Stage and listing-name filters added, with introductory questions distinct from NDA, document review, offers and finished conversations. Shared zero cash remains visible; no wealth-ranking score. Corrected misleading active count. Follow-up batch verification/release tracked separately.|
|10|Respectful follow-up|Audit pause/decline/reopen and preferences; no pressure or unlimited reminders.|
|11|NDA/signing|Account signing and safe corrections live. External signers, packets and email activation unfinished.|
|12|Confidential sharing|Existing protected documents. Found private broker notes on buyer-readable listing rows; migration 0067 preserves them in owner-only storage and sanitizes future writes. Isolated direct-access tests passed; production RLS enabled, anonymous access denied and zero notes remain on listing rows. Historical access not assessed. Owner read/edit UI and strict signed-NDA display added in follow-up. Full lifecycle audit remains.|
|13|Seller preparation|Eight-step owner-only reversible checklist covers authority, financial periods, reconciliation, add-backs, included assets, transfer questions, confidentiality and unresolved questions. Database owner/isolation tests and connected buyer denial, save/reload, EN/ES desktop/mobile accessibility passed. It is self-reported preparation, not a verification badge.|
|14|Acquisition checklist|Existing tailored tasks/NA/evidence/owners/deadlines; audit dependencies and reopening.|
|15|Due-diligence questions|Audit linking, answers, unresolved exports and advisor permissions.|
|16|Buyer education|Existing guides; audit contextual explanations and EN/ES consistency.|
|17|Future buyers|Audit saved preferences and opt-in re-engagement; no automatic sensitive disclosure.|
|18|Advisors/co-buyers|Audit actual transaction roles; explicit invitation and revocation required.|
|19|Compatibility|Inventory existing exports/imports; validate demand before new CRM integrations.|
|20|Notifications|In-app active; email foundations disabled. Provider approval, sender verification, scheduling and rehearsal outstanding.|
|21|Measurement|Audit events, privacy, definitions and reports; do not infer closing-rate uplift.|
|22|Fairness/privacy|No payment-linked credibility or opaque rejection scores. Review retention, sharing and human overrides.|
|23|End-to-end testing|Extend synthetic rehearsals to both buyer paths and failure cases, EN/ES, accessibility and roles.|
|24|Operations|Audit backup/restore evidence, monitoring, worker recovery, rollback, security and disclosures.|
|25|Human validation|Requires real brokers/buyers and observed sessions; cannot simulate completion.|

## External dependencies
- Specific Resend OAuth email-access approval remains unresolved; do not retry rejected authorization based on general permission.
- Database backup credentials, where unavailable, remain a user dependency previously allowed to be deferred.
- Legal counsel and independent security review require actual qualified reviewers.
- Real-user observations require participants; no fabricated accounts or feedback represented as real people.
- No paid or trial-only services without new explicit authorization; ongoing free-tier limits must be respected.
