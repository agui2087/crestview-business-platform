# Crestview private pilot plan

## Purpose and size

Run a two-to-four-week private pilot with 5–8 buyers and 3–5 brokers. The goal is to find workflow confusion and trust gaps, not to prove market demand statistically. Participants must consent to the pilot terms and understand that Crestview does not replace legal, tax, accounting, lending, or investment advice.

## Entry criteria

- Production monitoring, backup confirmation, restore drill, managed scanning decision, accessibility gate, and staging load gate are complete
- Privacy notice and pilot consent language are counsel-approved and published
- Test and demo data are removed; support and incident owners are named
- A participant can report a blocker without putting confidential document content into feedback
- A rollback owner and pilot pause rule are documented
- Migration `0026_private_pilot_feedback.sql` is applied and verified before `CRESTVIEW_PILOT_ENABLED=true` is set in production

Until that flag is explicitly enabled, the pilot navigation, page-event capture, and feedback page remain unavailable in production.

## Participant tasks

Buyer: create a profile, search/filter listings, compare an opportunity, request an NDA, review a deal workspace, upload and delete a non-sensitive test document, and report feedback.

Broker: create a draft listing, add an approved test NDA, publish to the pilot audience, review a buyer inquiry, approve/decline a financial-information request, and report feedback.

## Instrumentation and interviews

The product records authenticated page/task events and feedback in `pilot_events` and `pilot_feedback`. Do not record document contents, free-form field values, financial figures, emails, names, or third-party analytics identifiers. Page events are scheduled for deletion after 90 days; feedback is reviewed and purged or de-identified within 180 days.

Run a 20-minute opening interview and a 30-minute exit interview. Ask participants to describe what they expected before explaining the UI. Store interview notes in an access-controlled research folder, separate from product logs.

## Daily triage

- P0: security/privacy exposure, data loss, cross-account access — pause pilot immediately
- P1: core task blocked for multiple participants — fix or provide accessible workaround within one business day
- P2: repeated confusion or material trust problem — prioritize during pilot
- P3: preference or polish — backlog with frequency and role

## Exit decision

Proceed only if there are no open P0/P1 issues, at least 80% of core tasks are completed without facilitator intervention, no accessibility blocker remains, support response targets were met, and counsel/assessor prerequisites for the next phase remain satisfied. Otherwise extend or pause the pilot and document the reason.
