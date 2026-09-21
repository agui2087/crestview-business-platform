# NDA follow-up audit

Scope: signature replacement, countersigner preview, and availability messages after a partial signature. No database migration, entitlement change, new vendor or paid service.

## Findings and fixes

1. **Stale signature after invalid replacement.** Selecting a file now clears the previous uploaded signature immediately, resetting completed-field acknowledgments and consent. An invalid file or failed read cannot leave the old signature active. Stale read errors are ignored after a later upload/method change.
2. **Inaccurate countersigner preview.** Previously recorded drawn/uploaded signatures were shown as typed names to the second signer. The permission-checked signing page now passes validated recorded appearances into a shared signature preview. Screen-reader labels include the signer's recorded name. The completed PDF/evidence are unchanged.
3. **Misleading expired/withdrawn state.** An already-signed participant could see a waiting message after the request became unavailable. Expired and withdrawn explanations now take priority, while preserving recorded signature progress.
4. **Faded recorded signatures.** Recorded fields now receive completed styling and retain full opacity while remaining read-only, so the next signer can review them clearly.

## Regression checks

The isolated two-party browser rehearsal asserts that the first drawn signature appears for the broker, invalid replacement clears the broker's applied signature and consent, and expired/withdrawn requests do not falsely say they are waiting. It restores only its own synthetic controls, completes the signing flow and removes its synthetic records. Existing PDF hash, outsider access, mobile, desktop, accessibility and field-navigation checks remain in the rehearsal.

Release requires the connected rehearsal and repository quality gate to pass. No customer agreements are modified for testing.
