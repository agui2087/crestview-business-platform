# Private pilot checklist

## Before inviting participants

- [ ] Name product, security, support, and incident owners
- [ ] Complete every external gate in the enterprise-hardening status record
- [ ] Apply migration `0026_private_pilot_feedback.sql`
- [ ] Verify feedback access is row-level isolated and administrative reporting is least-privileged
- [ ] Test one buyer and one broker journey with non-sensitive data
- [ ] Approve consent, privacy, compensation, recording, and withdrawal language with counsel
- [ ] Prepare a support channel and escalation hours
- [ ] Prepare participant codes/roster outside application analytics

## For each session

- [ ] Confirm informed consent and recording choice
- [ ] Remind participant not to upload real confidential documents during the exercise
- [ ] Observe without coaching until the participant is blocked
- [ ] Record task completion, time, confidence, unexpected behavior, and facilitator intervention
- [ ] Ask the participant to submit in-product feedback
- [ ] Confirm any temporary document was deleted

## Daily

- [ ] Review error alerts, scan failures, failed webhooks/payments, and support messages
- [ ] Triage feedback by severity and participant role
- [ ] Pause immediately on security/privacy exposure, cross-account access, or data loss
- [ ] Verify test-data cleanup and record product changes

## Closeout

- [ ] Revoke participant access that should not continue
- [ ] Export only de-identified findings needed for product decisions
- [ ] Schedule pilot event deletion at 90 days and feedback deletion/de-identification at 180 days
- [ ] Record completion rates and unresolved friction by buyer/broker journey
- [ ] Make an explicit proceed, extend, or pause decision
