# Critical journey release gate

Every pull request and every change to `main` runs the same quality gate before release confidence is granted.

## Automated browser coverage

The browser suite runs in desktop Chrome and a Pixel 7 mobile viewport with deterministic local data and authentication. It verifies:

- Public home, How it Works, and pricing routes remain reachable.
- A first-time visitor can create an account and reach the dashboard.
- The account remains signed in after reload and is removed after sign-out.
- A buyer can open the broker marketplace, filter to Portland, and reach the NDA request form.
- A broker can understand the three-step listing flow, enter formatted financial figures, and reach draft and publish actions.
- Public account, acquisition, and pricing pages pass automated WCAG 2.2 A/AA checks.
- Buyer marketplace and broker listing workspaces pass the same WCAG checks on desktop and mobile.
- Every covered page has one main landmark, one primary heading, and no viewport-level horizontal overflow.
- Horizontally scrollable mobile workflows remain keyboard focusable.

## Required release checks

1. TypeScript validation
2. ESLint validation
3. Production dependency vulnerability audit
4. Unit and policy tests
5. Production build
6. Desktop and mobile critical-journey browser tests
7. Desktop and mobile WCAG accessibility tests

The browser server deliberately disables Supabase and enables development-only local authentication. This keeps the suite repeatable and prevents test records from entering production. Production authentication, database policies, Stripe webhooks, and deployment health remain covered by their separate operational checks and runbooks.

## When a journey changes

Update the matching browser scenario in the same pull request. A deliberate product change should update the expected user-visible outcome; a broken journey should fail before merge.
