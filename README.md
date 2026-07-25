# Crestview Business Operating Platform

Crestview is a modular business operating platform. Its first product, DealFlow AI, is designed to help acquisition entrepreneurs discover, evaluate, and track small-business opportunities with transparent evidence and explainable scoring.

The current build includes:

- a responsive public website;
- English and Spanish routes;
- a sign-in preview;
- an organization dashboard preview with sample data;
- initial security headers;
- architecture and product documentation.

Authentication, Supabase data, and OpenAI analysis are deliberately not connected yet. Preview screens identify sample or inactive functionality.

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
npm run build
```

Read the five root-level architecture documents before adding platform features.
