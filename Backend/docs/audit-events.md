# Audit Events — MetricASG

## 1. Purpose

Define the auditable operations in MetricASG and establish consistent rules for recording business and security-relevant changes.

This document specifies the audit event catalog, recording policy, and administrative query interface implemented under HU-040.

## 2. Event naming

Events use the format `resource.action`, with lowercase English names separated by underscores when necessary.

## 3. Event catalog

### Methodology
- `methodology.created`
- `methodology.updated`
- `methodology.published`
- `methodology.activated`
- `methodology.archived`
- `methodology_catalog.created`
- `methodology_catalog.updated`
- `methodology_catalog.deleted`

Catalog events apply to changes in methodological resources such as indicators, answers, maturity levels, and related catalogs.

### Users and organizations
- `user.created`
- `user.updated`
- `user.profile_updated`
- `user.state_changed`
- `user.password_changed`
- `company_member.removed`
- `company_invitation.created`
- `company_invitation.resent`
- `company_invitation.accepted`

Physical user deletion is excluded from the current administrative API. The `DELETE /api/users/{id}` endpoint has been removed to prevent unintended loss of historical information associated with evaluations, evidence, and company memberships.

Account suspension is handled through `POST /api/admin/change-user-state/{user_id}` and audited using `user.state_changed`.

If permanent account deletion becomes a requirement, a separate deletion and data-retention policy must be defined before introducing a corresponding `user.deleted` audit event.

Registration of company accounts and administrators must be mapped to their corresponding account-creation operations without producing duplicate logical events.

Changes to company roles or memberships must be included when an applicable write operation exists. Their exact event names and instrumentation points require verification against the current implementation.

### Evaluations
- `evaluation.submitted`

Evaluation draft autosave operations are excluded from the initial mandatory catalog to avoid excessive audit volume. This decision can be revisited if complete draft-change traceability becomes a requirement.

### Improvement plans
- `improvement_action.created`
- `improvement_action.updated`
- `improvement_action.deleted`

### Authentication and sessions
- `auth.login_succeeded`
- `auth.login_failed`
- `auth.logout_succeeded`

Failed login attempts are recorded using `auth.login_failed`, with a minimal reason code and without storing credentials or sensitive request payloads.

Refresh-token events remain outside the initial mandatory business-audit scope and may be considered under a separate security logging policy.

## 4. Minimum event context

Each event should identify, where applicable:
- Event type
- Authenticated actor ID
- Resource type and resource ID
- Company ID for organization-scoped operations
- UTC timestamp
- Minimal structured context necessary to interpret the operation

For changes involving an organization, the actor's role may be recorded when it is useful and can be established reliably.

## 5. Recording rules

1. Record successful, meaningful state changes.
2. Derive the actor from server-side authenticated identity, not client-supplied identifiers.
3. Avoid duplicate logical events across controllers and services.
4. Do not audit ordinary read-only GET requests in the initial scope.
5. Never store passwords, password hashes, JWTs, refresh tokens, invitation tokens, secrets, or complete sensitive request payloads.
6. Prefer structured identifiers and explicitly allowlisted contextual fields over complete before/after object snapshots.
7. Persist successful business audit events atomically with the corresponding business transaction where feasible.
8. Do not independently commit an audit event in a way that changes existing transaction semantics.
9. Do not interpret a flush as evidence of a committed operation.
10. Failed security events, if introduced, require a recording strategy independent of rolled-back business transactions.

## 6. Implementation boundaries

HU-040-T01 defines the catalog and policy.

HU-040-T02 defines the persistence model and minimum event schema.

HU-040-T03 integrates audit recording into critical write operations and verifies transaction behavior.

HU-040-T04 exposes authorized administrative queries with filters.

The event catalog defines the intended audit coverage. Implementation and verification status must be established through the corresponding source code and automated tests.

The administrative user-deletion endpoint was removed during HU-040-T03 after reviewing the existing referential integrity constraints. No `user.deleted` event is required for the currently supported administrative operations.

## Administrative audit queries (HU-040-T04)

The audit log API exposes a read-only administrative endpoint:

`GET /api/admin/audit-logs`

### Authorization

Access is restricted to authenticated users with the global `UserRole.ADMIN` role through `require_admin`.

Company-level roles, including `CompanyRole.COMPANY_ADMIN`, do not grant access to this endpoint unless the user also has the required global role.

Global administrators may query audit records across companies. The optional `company_id` parameter filters results but does not establish or modify authorization permissions.

### Supported filters

- `actor_id`: User responsible for the audited operation.
- `company_id`: Company associated with the event.
- `action`: Exact audit event name.
- `resource_type`: Exact resource type.
- `resource_id`: Resource identifier.
- `start_date`: Inclusive lower timestamp boundary.
- `end_date`: Inclusive upper timestamp boundary.

Date filters require timezone-aware ISO 8601 timestamps. The start date must not be later than the end date.

### Pagination and ordering

The endpoint supports:

- `limit`: Number of records returned, between 1 and 100. Default: 20.
- `offset`: Number of matching records skipped. Default: 0.

Records are ordered by `created_at` descending, followed by `id` descending.

### Response

The endpoint returns an object containing `total`, `limit`, `offset`, and `items`.

Each item contains the audit record's identifier, actor, company, action, resource information, context, and creation timestamp.

The endpoint does not modify existing audit records or commit database transactions.

### Access restrictions

Requests from users without the required global administrative role return HTTP 403.

Invalid query parameters return HTTP 422.