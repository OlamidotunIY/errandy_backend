# Notification — DDD & EIP Analysis

## 1. Current Responsibility

Orchestrates multi-channel notifications (email + push):

- **Unified notification sender**: `sendNotification` (line 18-44) sends email and/or push notification based on options.
- **Event listener**: `handleUserCreated` (line 46-65) listens to `user.created` event and sends welcome email.
- Delegates to:
  - `EmailService` (Resend adapter) for emails.
  - `PushService` (Firebase Cloud Messaging adapter) for push notifications.

**Files**: `notification.service.ts` (~70 lines), `notification.resolver.ts`, `notification.module.ts`.

## 2. Bounded Context Assessment

**This is infrastructure / application service**, NOT a bounded context.

- Notification is a **cross-cutting concern** — it's used by all bounded contexts (Errands, Escrow, Chat, etc.) to notify users.
- Notification has NO domain logic — it's a facade over Email + Push services.

**Overlaps**:

- **Email**: NotificationService depends on EmailService (line 3, line 40).
- **Push**: NotificationService depends on PushService (line 4, line 35).
- **Users**: Listens to `user.created` event (line 46) — couples to Users module.
- **All modules**: Every module can send notifications (e.g., "errand assigned", "payment received").

**Verdict**: Notification is an **application service layer**, NOT a domain module. Should be renamed to `common/notification/` or `infrastructure/notification/`.

## 3. Domain Model Audit

**No domain model** — Notification is purely infrastructure.

- `SendNotificationOptions` (line 8) is a DTO, not a domain entity.
- No aggregates, no invariants, no business rules.

**Data model (if it exists)**:

- Prisma likely has a `Notification` model (for storing notification history), but not seen in service.
- If so, it's an **event log** (read-only history), not a domain aggregate.

## 4. Layering Violations

**Cross-cutting concern in application layer**:

- `sendNotification` (line 18-44) orchestrates email + push — this is fine as an application service.
- However, service directly queries `prisma.user.findUnique` (line 21) — this is a data access concern, should be in infrastructure.

**Event listener in service**:

- `handleUserCreated` (line 46-65) is an event handler, NOT a service method.
- Should be in `application/event-handlers/OnUserCreatedSendWelcome.ts` (separate from service).

**Hardcoded templates**:

- Line 51: `template: 'welcome'` — hardcoded template name.
- Line 42: Template context is built inline (`{ ...options.email.context, name: user.name }`).
- Recommendation: Create notification template registry (centralized config).

## 5. Repository Pattern Gap

**Not applicable** — Notification is infrastructure, not domain.

- If `Notification` model exists (for history), it would need a repository:
  - `INotificationHistoryRepository` (save notification for audit trail).

## 6. EIP Opportunities

**Publish-Subscribe (Event-Driven)**:

- Current: `handleUserCreated` (line 46) listens to `user.created` event — this is correct usage of EventEmitter2.
- Recommendation: Extract all event handlers to `application/event-handlers/`:
  - `OnUserCreatedSendWelcome.ts`
  - `OnErrandAssignedNotifyProvider.ts`
  - `OnPaymentReceivedNotifyClient.ts`

**Message Channel**:

- Notifications could be queued in BullMQ (instead of synchronous):
  - When event is emitted, push notification job to queue.
  - Worker processes queue, retries on failure (email service down).
  - Benefits: Resilience, retry, dead-letter queue.

**Dead Letter / Retry**:

- Current: If email/push fails (line 40, line 35), error bubbles up.
- Line 58-64: Welcome email is try-catch wrapped (logs error but doesn't throw) — good for non-critical notifications.
- Recommendation: Queue ALL notifications in BullMQ:
  - Retry 3x on failure.
  - Move to dead-letter queue after max retries.
  - Alert ops team if DLQ threshold exceeded.

**Content-Based Router**:

- `sendNotification` (line 18-44) routes to Email and/or Push based on options:
  - If `options.email`, send email.
  - If `options.push && options.fcmToken`, send push.
- This is fine for simple routing, but could be a strategy pattern if notification channels grow (SMS, Slack, etc.).

**Message Translator**:

- Email templates (Resend) vs. Push payloads (FCM) have different formats.
- Recommendation: Create notification template objects:
  - `NotificationTemplate` (abstract): `{ title, body, data }`.
  - `EmailRenderer` (translates to Resend format).
  - `PushRenderer` (translates to FCM format).

## 7. Cross-Cutting Concerns

**Error handling**:

- `handleUserCreated` (line 46) wraps email sending in try-catch (line 58-64) — good.
- `sendNotification` (line 18) does NOT wrap — if email/push fails, error bubbles up.

**Logging**:

- Logs welcome email sent (line 61) and errors (line 62-64) — good.
- Should log ALL notification sends (email, push) for audit trail.

**Transactions**:

- Not applicable (notifications are idempotent side effects).

## 8. GraphQL-Specific Notes

**No GraphQL in Notification** (based on seen service):

- Notifications are sent asynchronously (event-driven), not via GraphQL mutations.
- If there's a mutation `sendTestNotification`, it should be admin-only (security).

**Authorization**:

- Not applicable (notifications are system-generated, not user-initiated).

## 9. Target Structure

```
src/common/notification/  # OR src/infrastructure/notification/
  application/
    NotificationService.ts          # Facade: sendEmail(), sendPush(), sendMultiChannel()
    event-handlers/
      OnUserCreatedSendWelcome.ts   # Listens to user.created → sends welcome email
      OnErrandAssignedNotifyProvider.ts
      OnPaymentReceivedNotifyClient.ts
      OnMessageSentNotifyRecipient.ts

  infrastructure/
    adapters/
      EmailAdapter.ts               # Wraps EmailService (Resend)
      PushAdapter.ts                # Wraps PushService (FCM)
    templates/
      NotificationTemplateRegistry.ts  # Centralized template config
    queues/
      NotificationQueue.ts          # BullMQ queue for async notification delivery
      NotificationWorker.ts         # Worker processes notification jobs

  domain/
    NotificationHistory.ts          # Aggregate: audit log of sent notifications (if needed)
    INotificationHistoryRepository.ts
```

**Alternative**: If notification history is not needed, remove domain layer entirely (pure infrastructure).

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Notification is infrastructure — refactoring won't break domain logic.
- However, every module depends on NotificationService — refactoring requires coordinated updates.

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. Notification is infrastructure — refactoring doesn't unlock domain modeling.
2. Current implementation is functional (no critical bugs).
3. Queueing notifications (BullMQ) can be done independently of domain refactoring.

**Migration steps**:

1. **Extract event handlers** from NotificationService to `application/event-handlers/`.
2. **Queue notifications** in BullMQ:
   - Create `NotificationQueue` and `NotificationWorker`.
   - Emit event → push job to queue → worker sends email/push.
3. **Add retry logic** (3x retry, dead-letter queue).
4. **Centralize templates** in `NotificationTemplateRegistry`.
5. **Add notification history** (optional: store sent notifications for audit trail).
6. **Add preference management** (optional: user can opt out of certain notifications).
7. **Move to `common/` or `infrastructure/`** (rename from `notification/` to clarify it's not a domain module).
