# Notification Events — HU-042

## Purpose

Define the notification event catalog for MetricASG.

This document establishes the event identifiers, triggering
conditions, recipients, and general rules for the centralized
notification system.

## Event Catalog

### REEVALUATION_REMINDER

Source: ReevaluationReminderService

Trigger:
- FIRST: 30 days before the next evaluation.
- SECOND: 7 days before the next evaluation.
- DUE: on the scheduled evaluation date.

Recipient:
- The user associated with the reevaluation.

Notes:
- Preserve the existing reminder scheduling.
- Reuse the existing deduplication mechanism.
- Avoid duplicate delivery when integrating notifications.

### COMPANY_INVITATION_CREATED

Source: CompanyInvitationService

Trigger:
- A company invitation is successfully created.

Recipient:
- The active user associated with the invitation email.

Notes:
- Do not expose invitation tokens or token hashes.
- Notifications must reference the invitation without exposing
  sensitive authentication information.

### COMPANY_INVITATION_RESENT

Source: CompanyInvitationService

Trigger:
- An existing invitation is successfully resent.

Recipient:
- The active user associated with the invitation email.

Notes:
- Respect the existing invitation resend cooldown.
- Each successful resend may generate a new notification event.
- Retrying the same delivery must not create duplicates.

### IMPROVEMENT_ACTION_DUE

Source: ImprovementActionNotificationService

Trigger:
- An improvement action is due within 7 days.
- The action status is PENDING or IN_PROGRESS.

Recipients:
- Active company members authorized as COMPANY_ADMIN
  or ASG_MANAGER.

Notes:
- The responsible field is free text and must not be treated
  as a user identifier.
- Avoid duplicate notifications for the same action and
  due-date reminder occurrence.

### IMPROVEMENT_ACTION_OVERDUE

Source: ImprovementActionNotificationService

Trigger:
- The target date has passed.
- The action status is PENDING or IN_PROGRESS.

Recipients:
- Active company members authorized as COMPANY_ADMIN
  or ASG_MANAGER.

Notes:
- Completed and cancelled actions must not generate
  overdue notifications.
- Repeated scheduler executions must not create duplicates.

## General Rules

1. Event identifiers must remain stable.
2. Every notification must have an identified recipient.
3. Notification generation and delivery must be idempotent
   for the same event occurrence and recipient.
4. User notification preferences must be respected.
5. Company notifications must respect membership and roles.
6. Notification data must not contain secrets or invitation tokens.
7. Audit logs and user notifications have separate purposes.
8. Existing reevaluation reminders must remain compatible.
9. Event generation must not compromise the main operation.
10. Delivery failures must be handled without creating
    duplicate notifications.


## Notification Channels

The centralized notification system supports:

- IN_APP: notifications displayed in the notification center.
- EMAIL: notifications associated with email delivery.

Reevaluation reminders integrate IN_APP and EMAIL notifications
with the existing reminder and delivery mechanisms.

Company invitation events generate IN_APP notifications for
eligible existing users. Invitation email delivery remains
independent from the centralized notification records.

Improvement action events currently generate IN_APP
notifications only.

## Preferences

Notification generation respects both global preferences
and event-specific preferences.

- Missing preferences are treated as enabled.
- A channel is enabled only when both preference levels
  permit it.
- Preferences are maintained independently for each user.
- IN_APP and EMAIL preferences are independent.

## Notification Lifecycle

Supported statuses:

- PENDING
- SENT
- FAILED
- CANCELLED

The notification center displays IN_APP notifications with
PENDING or SENT status.

Users can mark their own visible notifications as read.
The read operation is idempotent.

Cancelled and failed notifications are excluded from the
notification center and unread counter.

## Improvement Action Notification Rules

An eligible action must:

- Belong to an evaluation associated with a company.
- Have PENDING or IN_PROGRESS status.
- Have a target date within the next 7 days, including
  the current date, or have an overdue target date.

Eligible recipients must:

- Have an active user account.
- Have an active membership in the relevant company.
- Have COMPANY_ADMIN or ASG_MANAGER company role.
- Have IN_APP notifications enabled for the event.

Notification deduplication uses the action identifier,
event type and target date, in combination with the
recipient and channel uniqueness constraint.

Notifications become obsolete when the action, date,
recipient eligibility or preferences no longer satisfy
the generation rules.

Obsolete notifications are marked CANCELLED.

If the same notification becomes applicable again, the
existing CANCELLED record may be reactivated as PENDING
instead of creating a duplicate.

Reactivation preserves the notification identifier and
read history, including read_at.

## Scheduled Processing

The notification scheduler executes:

1. Reevaluation reminder generation.
2. Improvement action notification generation.

Both jobs run immediately when the scheduler starts and
then daily at 09:00 in settings.reminder_timezone.

Each job handles its own database session.

Failures are logged independently so one producer failure
does not prevent the other producer from executing.

Improvement action notification generation uses a
PostgreSQL transaction-level advisory lock to prevent
overlapping producer executions.

If the lock is unavailable, the competing execution
skips processing.

Transactions release the lock on commit or rollback.

## Implementation Boundaries

HU-042-T01:
- Define and document the event catalog.

HU-042-T02:
- Implement notification persistence and delivery/read states.

HU-042-T03:
- Implement global and event-specific notification preferences.

HU-042-T04:
- Implement the authenticated in-app notification center.

HU-042-T05:
- Integrate notification producers with reevaluations,
  company invitations and improvement actions.
- Integrate scheduled processing for applicable events.

All five catalogued event types have backend integrations.
Delivery channels and operational behavior vary by event,
as documented above.
