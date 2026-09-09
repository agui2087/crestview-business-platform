# Accessibility release gate

Target: WCAG 2.2 Level AA for buyer, broker, public, billing, and document workflows on current desktop and mobile browsers.

## Automated gate

`npm run test:e2e` runs axe-core against public pages and authenticated dashboard workspaces in desktop Chrome and a Pixel 7 viewport. The suite also rejects horizontal page overflow, missing single primary headings, broken skip navigation, inaccessible current-page navigation, and keyboard-inaccessible mobile menus.

Automated checks cover detectable semantics, names, roles, contrast, and structural failures. They do not prove full conformance.

## Manual assistive-technology matrix

Complete before each major release and retain the dated result:

| Platform | Assistive technology | Required journeys |
| --- | --- | --- |
| macOS / Safari | VoiceOver | Sign in, listings search, NDA request, documents, feedback |
| Windows / Chrome | NVDA | Dashboard, marketplace filters, broker listing form, billing |
| iOS / Safari | VoiceOver + zoom at 200% | Mobile navigation, listing details, documents, feedback |
| Android / Chrome | TalkBack + large text | Mobile navigation, search filters, forms, error recovery |
| Desktop browser | Keyboard only | Skip link, all navigation, menus, dialogs, upload, submit/error focus |

For each journey verify reading order, concise labels, field instructions, error announcement, focus visibility, focus return after overlays, no keyboard trap, control target size, reflow at 320 CSS px, and meaning without color.

## Release decision

- Block release for any critical/serious axe violation, keyboard trap, inaccessible core action, lost focus, or content loss at 200% zoom.
- High-impact manual failures require a fix and retest.
- Record lesser issues with owner and deadline; accessibility exceptions require product-owner approval and a documented accessible alternative.
