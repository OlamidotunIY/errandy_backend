# Queues — DDD & EIP Analysis

## 1. Current Responsibility

BullMQ job queue infrastructure:

- **Processors**: `processors/` directory likely contains job workers (process background tasks).
- **Scheduler**: `scheduler/` directory likely contains cron jobs (scheduled tasks).
- **Module file**: `queues.module.ts` configures BullMQ.

**Files**: `queues.module.ts`, `processors/`, `scheduler/`.

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- Queues is a **technical adapter** for BullMQ (job queue system) — no domain logic.
- Queues is a **cross-cutting concern** for async task processing (email sending, file uploads, refunds, etc.).

**Verdict**: Queues is an **infrastructure layer**. Should remain as `infrastructure/queues/` or `common/queues/`.

## 3. Domain Model Audit

**No domain model** — Queues is purely infrastructure (job processing).

- Job payloads are DTOs, not domain entities.
- No aggregates, no invariants, no business rules.

## 4. Layering Violations

**None** — Queues is correctly positioned as infrastructure.

- However, if domain logic is in queue processors (e.g., business rules in job handler), that's a violation.
- Recommendation: Queue processors should call application services/command handlers (keep processors thin).

## 5. Repository Pattern Gap

**Not applicable** — Queues is infrastructure, not domain.

## 6. EIP Opportunities

**Message Queue (BullMQ)**:

- Current: BullMQ infrastructure is set up.
- **Should be used for**:
  - Email sending (retry on Resend timeout).
  - Push notifications (retry on FCM timeout).
  - File uploads (retry on Firebase timeout).
  - Payment refunds (retry on Paystack timeout).
  - Webhook delivery (retry on HTTP timeout).

**Dead Letter Queue**:

- BullMQ supports dead-letter queues (jobs that failed after max retries).
- Recommendation: Monitor DLQ, alert ops team if threshold exceeded.

**Retry Pattern**:

- BullMQ supports exponential backoff (retry with increasing delays).
- Recommendation: Configure retry policy per queue type (e.g., email: 3 retries, payment: 5 retries).

**Scheduler (Cron Jobs)**:

- `scheduler/` directory likely contains scheduled tasks:
  - Cleanup expired escrows.
  - Send reminder notifications.
  - Aggregate analytics.
  - Clean up orphaned files.

## 7. Cross-Cutting Concerns

**Error handling**:

- Queue processors should handle errors gracefully (log error, retry or move to DLQ).

**Logging**:

- Queue processors should log job start/completion/failure for debugging.

**Monitoring**:

- Monitor queue depth (number of pending jobs) — if queue grows too large, alert ops team.

## 8. GraphQL-Specific Notes

**Not applicable** — Queues is infrastructure, not exposed via GraphQL.

## 9. Target Structure

```
src/infrastructure/queues/  # OR src/common/queues/
  queues.module.ts              # BullMQ configuration

  processors/
    EmailProcessor.ts           # Processes email sending jobs (retries on failure)
    PushProcessor.ts            # Processes push notification jobs
    FileUploadProcessor.ts      # Processes file upload jobs
    RefundProcessor.ts          # Processes payment refund jobs

  scheduler/
    EscrowCleanupScheduler.ts   # Cron job: cleanup expired escrows
    NotificationScheduler.ts    # Cron job: send reminder notifications
    AnalyticsScheduler.ts       # Cron job: aggregate analytics
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Queues infrastructure exists but may not be fully used — adding queue jobs is low-risk.

**Priority**: **PHASE 1-2 (parallel with Escrow/Payment-Gateway)**
**Rationale**:

1. Queues are critical for reliability (payment refunds, email delivery) — implement early.
2. Queue refunds (Payment-Gateway) in Phase 1 (prevents financial loss if refund fails).
3. Queue notifications (Email/Push) in Phase 2 (improves resilience).

**Migration steps**:

1. **Create queue processors** for:
   - Email sending (retry 3x on Resend timeout).
   - Push notifications (retry 3x on FCM timeout).
   - File uploads (retry 3x on Firebase timeout).
   - Payment refunds (retry 5x on Paystack timeout).
2. **Configure retry policies** (exponential backoff, max retries, DLQ).
3. **Add monitoring** (queue depth, DLQ size).
4. **Add scheduled jobs** (cleanup expired escrows, send reminders).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Queue job envelope shared by background processors.
 * // TODO: Job metadata is currently transient; no dedicated Prisma model exists.
 */
class QueueJobEnvelope {
  constructor(
    public readonly queueName: string,
    public readonly jobName: string,
    public readonly payload: Record<string, unknown>,
    public readonly attempts: number,
  );

  /**
   * Validates queue and job names before enqueue.
   */
  validate(): void;
}
```

### Repository Interface

```typescript
/**
 * Optional persistence for queue processing outcomes.
 * // TODO: Decide whether WebhookEvent can store failed job metadata.
 */
interface IQueueAuditRepository {
  /**
   * Stores failed job details for retry analysis.
   */
  saveFailedJob(job: QueueJobEnvelope, reason: string): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Enqueues generic background jobs.
 */
class EnqueueJobCommandHandler {
  /**
   * Pushes a queue job into broker and emits QueueJobEnqueuedEvent.
   */
  execute(command: EnqueueJobCommand): Promise<void>;
}

interface EnqueueJobCommand {
  queueName: string;
  jobName: string;
  payload: Record<string, unknown>;
  attempts?: number;
}
```

### Domain Events

```typescript
/**
 * Emitted when a background job is enqueued.
 */
class QueueJobEnqueuedEvent {
  constructor(
    public readonly queueName: string,
    public readonly jobName: string,
    public readonly enqueuedAt: Date,
  );
}

/**
 * Emitted when a background job is permanently failed.
 */
class QueueJobFailedEvent {
  constructor(
    public readonly queueName: string,
    public readonly jobName: string,
    public readonly reason: string,
  );
}
```
