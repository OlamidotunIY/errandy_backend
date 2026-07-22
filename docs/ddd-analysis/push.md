# Push — DDD & EIP Analysis

## 1. Current Responsibility

Sends push notifications via Firebase Cloud Messaging (FCM):

- **Single recipient**: `sendPush` (line 16-63) sends push notification to one FCM token.
- **Multiple recipients**: `sendPushToMultiple` (line 65-100+) sends batch push notifications.
- **Platform-specific payloads**: Configures Android (high priority, click action) and iOS (APNS with badge, sound).

**Files**: `push.service.ts` (~100+ lines), `push.interface.ts`, `push.module.ts`.

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- Push is a **technical adapter** for Firebase Cloud Messaging — it has no domain logic.
- Push is a **cross-cutting concern** used by Notification, Chat, Errands, etc.

**Verdict**: Push is an **infrastructure layer** (Ports & Adapters outer layer). Should be renamed to `infrastructure/push/` or `common/push/`.

## 3. Domain Model Audit

**No domain model** — Push is purely infrastructure.

- `PushNotificationPayload` (line 3) is a DTO, not a domain entity.
- No aggregates, no invariants, no business rules.

## 4. Layering Violations

**None** — Push service is correctly positioned as infrastructure.

- However, `PushService` is directly imported by `NotificationService` (tightly coupled).
- Recommendation: Introduce `IPushService` interface (port), `FcmPushService` as implementation (adapter).

## 5. Repository Pattern Gap

**Not applicable** — Push is infrastructure, not domain.

## 6. EIP Opportunities

**Adapter Pattern** (should be implemented):

- Current: `PushService` is tightly coupled to Firebase Cloud Messaging (line 25-48: `admin.messaging().send`).
- Recommendation: Extract `IPushService` interface:
  - `FcmPushAdapter` implements interface.
  - Allows switching to OneSignal, AWS SNS, etc., without changing callers.

**Dead Letter / Retry**:

- Current: If FCM call fails (line 54-60), error is logged and `false` is returned — no retry.
- Specific handling for invalid tokens (line 56-60): Logs warning — should trigger cleanup (delete invalid token from DB).
- Recommendation: Queue push notifications in BullMQ:
  - Retry 3x on transient failures (network errors).
  - Move to dead-letter queue for invalid tokens (trigger token cleanup).

**Invalid Token Cleanup**:

- Line 56-60: Logs invalid FCM token, but doesn't clean up (orphaned token remains in User table).
- Recommendation: Emit `FcmTokenInvalid` event → event handler deletes token from DB.

## 7. Cross-Cutting Concerns

**Error handling**:

- Logs errors (line 54) and returns `false` — good resilience (doesn't throw, so caller can continue).
- Specific error codes handled (line 56-60: `messaging/invalid-registration-token`) — good.

**Logging**:

- Logs success (line 51) and errors (line 54, line 59) — good.

**Validation**:

- No validation of FCM token format (assumes caller provides valid token).
- No validation of payload (assumes caller provides valid title/body).

## 8. GraphQL-Specific Notes

**Not applicable** — Push is infrastructure, not exposed via GraphQL (push notifications are sent server-side, not by client requests).

## 9. Target Structure

```
src/infrastructure/push/  # OR src/common/push/
  domain/
    IPushService.ts                 # Port (interface)

  infrastructure/
    adapters/
      FcmPushAdapter.ts             # Adapter (implements IPushService)
    queues/
      PushQueue.ts                  # BullMQ queue for async push delivery
      PushWorker.ts                 # Worker processes push jobs
    event-handlers/
      OnFcmTokenInvalidCleanup.ts   # Listens to FcmTokenInvalid → deletes token from DB
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Push is infrastructure — refactoring won't break domain logic.
- Current implementation is functional (no critical bugs).

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. Push is infrastructure — refactoring doesn't unlock domain modeling.
2. Queueing push notifications (BullMQ) can be done independently of domain refactoring.
3. Invalid token cleanup is minor improvement — not critical.

**Migration steps**:

1. **Extract IPushService interface** (port).
2. **Rename PushService to FcmPushAdapter** (adapter).
3. **Queue push notifications in BullMQ** (retry 3x on failure).
4. **Emit FcmTokenInvalid event** when token is invalid → trigger cleanup.
5. **Add push notification rate limiting** (prevent spam).
