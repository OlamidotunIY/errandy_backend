# Module: notification

## Folder placement

```
src/modules/notification/
├── domain/
│   ├── entities/
│   │   ├── notification-log.entity.ts
│   │   └── notification-preference.entity.ts
│   ├── repositories/
│   │   ├── notification-log.repository.interface.ts
│   │   └── notification-preference.repository.interface.ts
│   ├── events/
│   │   ├── notification-sent.event.ts
│   │   └── notification-failed.event.ts
│   └── errors/
│       └── notification-delivery.error.ts
├── application/
│   ├── commands/
│   │   ├── send-notification/       (checks NotificationPreference per channel before dispatch)
│   │   └── update-notification-preference/
│   ├── event-handlers/               (near-universal sink — representative subset shown)
│   │   ├── on-profile-created.handler.ts
│   │   ├── on-application-submitted.handler.ts
│   │   ├── on-application-accepted.handler.ts
│   │   ├── on-errand-assigned.handler.ts
│   │   ├── on-errand-completed.handler.ts
│   │   ├── on-payment-failed.handler.ts
│   │   ├── on-withdrawal-completed.handler.ts
│   │   ├── on-verification-completed.handler.ts
│   │   ├── on-dispute-opened.handler.ts
│   │   ├── on-message-sent.handler.ts
│   │   ├── on-trusted-circle-member-share-suggested.handler.ts
│   │   └── on-rating-submitted.handler.ts
│   ├── jobs/
│   │   └── retry-failed-notifications.job.ts
│   └── queries/
│       └── list-notifications-by-user/
├── infrastructure/
│   ├── adapters/
│   │   ├── email.adapter.ts
│   │   ├── sms.adapter.ts
│   │   └── push-notification.adapter.ts
│   ├── mappers/
│   │   ├── notification-log.mapper.ts
│   │   └── notification-preference.mapper.ts
│   └── repositories/
│       ├── notification-log.repository.ts
│       └── notification-preference.repository.ts
└── notification.module.ts
```

## Prisma schema

```prisma
model NotificationLog {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  userId        String   @db.ObjectId
  type          String
  channel       String   // EMAIL | SMS | PUSH
  payload       Json
  status        String   @default("SENT")   // SENT | FAILED
  failureReason String?
  createdAt     DateTime @default(now())

  @@index([userId])
}

model NotificationPreference {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  userId       String   @unique @db.ObjectId
  emailEnabled Boolean  @default(true)
  smsEnabled   Boolean  @default(true)
  pushEnabled  Boolean  @default(true)
  updatedAt    DateTime @updatedAt
}
```

## Domain entity methods

**`NotificationLog`**
- `create(userId, type, channel, payload)` — starts `SENT` optimistically, or is this constructed only *after* the adapter call resolves? Cleaner: construct with `status` passed in directly from the adapter's result (`markSent()`/`markFailed(reason)` as the only two terminal states, no pending state needed since delivery is fire-and-forget from this module's perspective, retried by `RetryFailedNotificationsJob` rather than tracked as in-flight)

**`NotificationPreference`**
- `updatePreferences(emailEnabled?, smsEnabled?, pushEnabled?)`

## Repository interfaces

```typescript
abstract class INotificationLogRepository {
  abstract save(log: NotificationLog): Promise<void>;
  abstract findById(id: string): Promise<NotificationLog | null>;
  abstract findByUserId(userId: string, pagination: { limit: number; cursor?: string }): Promise<{ items: NotificationLog[]; nextCursor?: string }>;
  abstract findFailed(): Promise<NotificationLog[]>;   // used by RetryFailedNotificationsJob
}
abstract class INotificationPreferenceRepository {
  abstract save(preference: NotificationPreference): Promise<void>;
  abstract findByUserId(userId: string): Promise<NotificationPreference | null>;
}
```

## DTOs

```typescript
// commands/send-notification/send-notification.request.dto.ts
interface SendNotificationRequestDto {
  userId: string;
  type: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  payload: Record<string, unknown>;
}

// commands/update-notification-preference/update-notification-preference.request.dto.ts
interface UpdateNotificationPreferenceRequestDto {
  userId: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
}

// queries/list-notifications-by-user/list-notifications-by-user.request.dto.ts
interface ListNotificationsByUserRequestDto {
  userId: string;
  limit: number;
  cursor?: string;
}
interface NotificationLogResponseDto {
  id: string;
  type: string;
  channel: string;
  status: string;
  createdAt: string;
}
```

## Open items

- Whether critical sends (OTP, security alerts) should bypass `NotificationPreference` muting — still open, carried from the main doc.
