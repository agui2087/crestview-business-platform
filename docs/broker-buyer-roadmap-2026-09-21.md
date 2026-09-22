# Inclusive broker and buyer roadmap

Requested: all 25 workstreams plus a broker profile section. No workstream is complete merely because a page exists. Each needs implementation review, authorization tests, relevant browser rehearsal and verified production deployment. Human validation and independent reviews must not be represented as software deliverables.

## Added priority: broker profiles
Implementation in progress: separate public-safe data, draft/publish controls, broker-only editing, public directory and profile, specialities/areas/languages/approach and welcome for preparing buyers. No automatic publication of account contact data, claims of verified credentials, fabricated reviews or deal counts.

## Workstream ledger
| # | Workstream | Current evidence / remaining work |
|---|---|---|
|1|Existing feature audit|Started. Buyer settings already include preferences, funding, summary and financial-sharing controls. Continue full inventory.|
|2|Welcoming buyer paths|Explicit preparing/active paths and tailored next steps need review and implementation.|
|3|Reusable buyer profile|Existing settings; audit validation, reuse, defaults and visibility.|
|4|Readiness checklist|Audit acquisition checklist versus buyer preparation; avoid rejection scores.|
|5|Financial readiness/privacy|Existing funding and sharing fields; audit evidence labels, review provenance and expiry.|
|6|Financing preparation|Existing financial scenarios; audit assumptions and lender-preparation workflow.|
|7|Listing clarity|Audit financial periods, included assets, requirements and corrections.|
|8|Inquiry types|Audit current inquiries; add preparing/public-question intent without granting confidential access.|
|9|Broker pipeline|Existing deal inbox and signing center; audit readiness context, actions and handoffs.|
|10|Respectful follow-up|Audit pause/decline/reopen and preferences; no pressure or unlimited reminders.|
|11|NDA/signing|Account signing and safe corrections live. External signers, packets and email activation unfinished.|
|12|Confidential sharing|Existing protected documents; audit full permission and lifecycle matrix.|
|13|Seller preparation|Audit requests, financial periods, add-backs and provenance.|
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
