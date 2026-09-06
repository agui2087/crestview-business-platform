# Crestview authorization matrix

This matrix is the required access contract for application routes and server actions. A route must deny access unless every listed condition is satisfied.

| Area | Visitor | Buyer | Broker | Brokerage admin | Platform admin |
| --- | --- | --- | --- | --- | --- |
| Public pages and published listings | Read | Read | Read | Read | Read |
| Personal profile and preferences | None | Own | Own | Own | Own |
| Saved opportunities and checklist | None | Own | Own buyer activity | Own buyer activity | Audited support tool only |
| Buyer inquiries | None | Own inquiries | Assigned listing inquiries | Organization inquiries | Audited support tool only |
| Listing creation and editing | None | None | Own listings | Organization listings | Audited moderation tool only |
| NDA templates | None | Signed copy only | Own listing templates | Organization templates | Audited support tool only |
| Financial-access decisions | None | Request only | Assigned listing decisions | Organization decisions | Audited support tool only |
| Deal-room documents | None | Explicitly released documents | Assigned listing documents | Organization documents | Audited support tool only |
| Workforce records | None | None | Own organization if enabled | Own organization | Audited support tool only |
| Billing and entitlements | None | Own | Own | Organization when implemented | Read-only operational view |
| Platform administration | None | None | None | None | Database role required |

## Enforcement rules

1. Supabase Auth UUID is the canonical identity for the production application.
2. Email addresses are display and communication attributes, never authorization keys.
3. Organization access requires an active membership record; a claimed role in a form or URL is insufficient.
4. Service-role clients may only run after the requesting user and resource ownership are verified.
5. Signed storage URLs are short-lived and issued only after the same authorization check as the underlying record.
6. Platform administrators are stored in `platform_administrators`, can be granted or revoked only by an active administrator, and cannot revoke their own access.
7. Denials must not reveal whether another user's resource exists.
