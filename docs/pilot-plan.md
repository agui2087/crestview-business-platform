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

## Inclusive buyer/broker rehearsal protocol

Use synthetic businesses and documents. These are task prompts, not evidence that human validation has happened. Do not tell participants which button to press before observing their attempt.

### Buyer who is still preparing

1. Create a private profile without an organization or committed financing. Choose the preparing path and record zero available cash if that matches the synthetic scenario.
2. Find the next preparation step and explain what remains private. Confirm the participant does not interpret preparation as a rejection or lender approval.
3. Ask a question about a public listing before signing an NDA. Ask what information the broker can now see and whether any private documents were unlocked.
4. Pause routine follow-up, leave and return, then resume. Ask what happens to messages, contractual deadlines and existing permissions.
5. Find a useful next action that does not require buying a subscription or claiming funds they do not have.

### Buyer actively reviewing a business

1. Identify the financial reporting period and whether figures are actual, projected or unspecified. Explain the difference between a missing value and zero.
2. Review an approved synthetic NDA and sign only after reading it. Confirm signing does not imply financial-access approval or transfer ownership.
3. Follow the acquisition checklist, record an unresolved diligence item, and find its next action. Do not mark it verified merely because a document arrived.
4. Download unresolved research and explain which private information is included before choosing whether to share it outside Crestview.
5. Explain the difference between a private plan, shared deal-room conversation and lender summary. Identify where to report an error.

### Broker

1. Draft a broker profile, check that private contact details are not automatically published, publish it, then unpublish it.
2. Prepare a synthetic listing, label financial periods/basis, and distinguish private seller preparation from public disclosures.
3. Find an introductory question, respond without granting private-document access, and explain the buyer's self-reported funding information without treating it as verified.
4. Recognize a paused follow-up request before sending a routine reply. Explain why essential records and permissions remain unchanged.
5. Decline with an actionable explanation, reopen screening, and confirm reopening did not grant document access.
6. Revoke an approved synthetic document's access and verify the buyer can no longer download it. Record any cached-link behavior separately.

### Record outcomes without sensitive content

For each task record a participant code, role/path, completed/unassisted/blocked result, elapsed time, observed misunderstanding, assistance given and issue reference. Do not collect actual financial figures, passwords, signed documents or names in the research log. Record accessibility needs only with consent and only as necessary to reproduce a barrier. Report results separately for preparing buyers, active buyers and brokers; do not hide a failing group in an overall average.

Permission confusion, unauthorized access, loss of private work, or a belief that payment buys verified status are release blockers. Free-versus-paid confusion must be resolved before charging participants. These acceptance checks supplement, not replace, the entry criteria above.

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
