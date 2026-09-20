# NDA signing expansion and three-pass audit

## Scope

Prepared PDFs now support buyer and broker fields, buyer-first / broker-first / either-order signing, typed / drawn / PNG-JPEG signature appearances, full-name / company / title / text / required checkbox fields, and reusable layouts for the exact same PDF. The existing single-buyer workflow remains supported.

Each assigned participant must have a signature field. Signatures are recorded separately. NDA-gated access remains closed until every assigned participant signs and the completed PDF is stored. Financial access still requires its separate approval. Existing delivered layouts and completed agreements remain immutable.

The signing page shows participant progress and provides an authenticated request link to send using the broker's existing email. This does not automatically send email, add recipients, or grant access. The next participant receives an in-app notification. Existing in-app reminder, expiration, withdrawal and evidence controls remain available.

## Audit 1: data integrity and authorization

- Added database coverage for buyer-first, broker-first and either-order signing, wrong-role attempts, stale/concurrent snapshots, partial completion, missing final artifacts, expiry, protected document visibility and outsider isolation.
- Prevented the old buyer-only completion function from accepting a two-party layout.
- Corrected final evidence creation to occur inside the original signed transition. The existing signed-record edit guard remains enforced.
- Rejected null assigned field values and invalid appearance modes at the database boundary.
- Made preset quota enforcement atomic; replacing an existing name works at the 20-preset limit.

## Audit 2: connected browser workflow

- Rehearsed buyer drawing and broker image signing on a two-page synthetic PDF against the isolated test database.
- Verified first-signature pending state, broker-first access denial in a buyer-first workflow, final evidence containing both appearances, completed-file hash, and outsider download denial.
- Fixed accessible names for newly added selection controls.
- Checked English and Spanish preparation, desktop and mobile overflow, keyboard placement/navigation, accessibility scan, and render-failure prevention of signing.
- Rehearsed saved preset creation and selection.

## Audit 3: regression and output review

- Re-ran the original single-buyer signing browser rehearsal.
- Rendered and visually inspected both pages of the countersigned PDF, including drawn signature aspect ratio, uploaded image, date, company, checkbox and initials.
- Corrected stale image-upload callback handling and preset network-error feedback; improved participant evidence labels.
- Production release must pass the repository CI suite before merge, and the production migration must precede the application deployment.

## Boundaries

- Two existing deal participants, not arbitrary outside signers, organizations, witnesses or signing groups.
- Required fields only; no conditional logic, optional field rules or bulk envelopes.
- No automatic email/SMS sending, reminders by email, external identity verification, certificate-authority seal, qualified electronic signature or legal certification.
- Electronic acceptance is tied to the authenticated account and recorded consent, not independent proof of the person's identity. Counsel should review intended agreement use and applicable requirements.
- Presets match the PDF SHA-256 exactly; changes affect future requests, not delivered agreements.
- Signature images are limited to PNG/JPEG, 160 KB and 2,000 pixels per side. Drawings have bounded points and strokes. Original document screening remains in place.

## Repeatable checks

`npm test` includes database and PDF tests. `scripts/verify-visual-nda.mts` runs the existing single-buyer rehearsal; `NDA_COUNTERSIGN_TEST=1` adds two-party signing, drawing, uploaded image, custom fields and presets. It hard-blocks any database other than the isolated staging project and cleans up the synthetic records it creates. Never use real customer agreements for these tests.
