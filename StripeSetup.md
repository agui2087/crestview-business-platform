# Crestview Stripe sandbox setup

The application uses Stripe-hosted Checkout for one-time purchases and
subscriptions, plus the Stripe Customer Portal for subscription management.
Access is granted only by verified webhook events. A successful browser
redirect never grants an entitlement.

## Required environment variables

Set these separately for local development and the Vercel Preview environment:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_RESTRICTED_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CRESTVIEW_PRO`
- `STRIPE_PRICE_SINGLE_LISTING`
- `STRIPE_PRICE_BROKER_PLAN`
- `STRIPE_PRICE_ENHANCED_VISIBILITY`
- `STRIPE_PRICE_HIGHEST_VISIBILITY`
- `STRIPE_PRICE_WORKFORCE`

Keep server credentials in environment-variable secret storage. Never add a
restricted key, secret key, or webhook signing secret to Git.

## Restricted key permissions

Create a sandbox restricted key with only the permissions needed by this app:

- Customers: read and write
- Checkout Sessions: read and write
- Billing Portal Sessions: write

If Stripe reports a permission error during sandbox testing, review the failed
request in Stripe Workbench and add only the specific missing permission.

## Supabase

Run `supabase/migrations/0010_stripe_billing.sql` before testing payments. It
creates customer, subscription, entitlement, and webhook-event records with
row-level security. The webhook applies each Stripe event atomically, and the
event ID prevents duplicate processing.

## Webhook

Create a Stripe sandbox webhook endpoint:

`https://YOUR_DEPLOYMENT/api/stripe/webhook`

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET` in the same
environment as the endpoint.

## Customer Portal

Configure the sandbox Customer Portal in Stripe before testing the **Manage
billing** button. Enable payment-method updates, invoice history, and
subscription cancellation. Product changes should stay disabled until upgrade
and downgrade rules are intentionally designed.

## Before live mode

Create separate live Products and Prices, a separate live restricted key, and a
separate live webhook endpoint. Never reuse sandbox IDs or credentials in
production. Automatic tax remains disabled until Crestview has confirmed its
tax registrations and tax policy.
