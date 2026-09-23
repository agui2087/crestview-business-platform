# Buyer marketplace filters

## Scope
Public listings and signed-in marketplace use the same query parser and filters. Keywords, exact city/state, industry, minimum/maximum price, minimum annual revenue, minimum cash flow, reported seller financing, and explicit sorting work together. URL parameters preserve applied filters across reloads; Clear all filters returns to the unfiltered route. Financial criteria are collapsed until needed.

Invalid amounts and reversed price ranges display a corrective error instead of silently removing constraints. Unknown financial values are excluded when the corresponding constraint is selected and sort last. Default ordering retains existing disclosed promotion placement; explicit price/revenue/cash-flow ordering respects the buyer's selection.

The separate source-opportunity search now shares exact location matching, validates maximum prices, clears keywords on reset, uses native location suggestions, and translates its controls and result messages into Spanish. Source records remain separate from broker-posted marketplace records; this change does not certify their freshness.

## Evidence, September 23, 2026
- 305 automated tests passed, including four new shared-filter regression tests.
- 10 focused Chromium browser checks passed across desktop and mobile: EN/ES public filters, combination, reload, invalid input, reset, sorting, keyboard focus order, overflow, authenticated marketplace, and existing broker/NDA entry workflow.
- Production dependency audit reported no vulnerabilities.
- Read-only production inspection found two withdrawn listings and no published listings. Nothing was republished, manufactured, or modified in the database.

## Boundaries
No database migration, payment modification, or document-security change. This is filter verification, not a claim of a complete screen-reader audit or real-broker user testing. Hosted quality gates and deployment health must pass before calling this release live.
