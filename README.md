# Crestview Business Operating Platform

Crestview is a modular business operating platform. Its first product, DealFlow AI, is designed to help acquisition entrepreneurs discover, evaluate, and track small-business opportunities with transparent evidence and explainable scoring.

The current build includes:

- a responsive public website;
- English and Spanish routes;
- Supabase-backed authentication/data with a local-only development fallback;
- buyer, broker, listing, NDA, document-vault, billing, workforce, and pilot-feedback workflows;
- private document storage with signature validation, quotas, retention metadata, and optional fail-closed Cloudmersive scanning;
- enforced browser security headers, structured/redacted error reporting, production monitoring, encrypted backup/restore drills, and CI security gates;
- desktop/mobile accessibility checks and repeatable load-test budgets;
- architecture, recovery, legal-draft, pilot, and independent-review documentation.

## Getting Started

Install dependencies, then run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route sends visitors to the English experience at `/en`; Spanish is available at `/es`.

## Configuration

Copy `.env.example` to `.env.local` only after creating the corresponding external projects. Never commit real credentials.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run test:load` runs the versioned performance scenarios. Authenticated and upload scenarios require an isolated staging session; the runner refuses document-upload writes to known production hosts.

Start with `docs/enterprise-hardening-status-2026-09-09.md` for the implementation record and the production actions that still require Geo, account credentials, counsel, external vendors, or pilot participants.
