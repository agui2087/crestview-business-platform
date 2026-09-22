# Deal-room file access verification

## Scope

This release replaces browser-visible signed storage links for deal-room uploads
with session-bound file routes. PDF viewing and downloads use the same permission
boundary. No database migration, paid service, or change to upload screening is
required. NDA originals and other document systems are outside this release.

Every file request checks the current user, deal participation, active document,
screening status and existing row-level security. Storage download also uses that
user's session, never the service role. Responses are private/no-store, never
redirect to a storage token, and non-PDF files are forced to download.

Revocation blocks subsequent requests. It cannot erase bytes already delivered,
revoke external-service links, or invalidate previously issued storage tokens
before their expiry. This is access control, not digital rights management.

## Verification

- 299 automated tests passed, including six focused file/PDF access checks.
- Local production build, type checking and lint passed before release submission.
- `scripts/verify-deal-file-access.mts` ran against the isolated Supabase project
  and local production build: real CSV bytes, anonymous/unrelated/pre-NDA denial,
  broker access, buyer access after signing, repeated-link denial after revocation,
  independent financial approval, inactive-file denial, no redirect/no-store.
- Synthetic records, storage file and three accounts were cleaned up.
- Full hosted checks and production deployment must pass before marking live.

## Next within the lifecycle audit

Safe replacement/version history and request-fulfillment behavior remain separate
work. Do not treat this release as completion of the entire document lifecycle.
