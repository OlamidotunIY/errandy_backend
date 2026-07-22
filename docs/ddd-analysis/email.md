# Email — DDD & EIP Analysis

## 1. Current Responsibility

Sends emails via Resend API:

- **Template-based emails**: `sendEmail` (line 25-94) sends emails using Resend templates (e.g., `'welcome'` template).
- **Raw HTML emails**: Fallback to raw HTML if no template specified (line 73-94).
- **Email type routing**: Supports `'promotional'` vs. `'transactional'` sender addresses (line 13-15: different `from` addresses).

**Files**: `email.service.ts` (~95 lines), `email.interface.ts`, `email.module.ts`.

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- Email is a **technical adapter** for Resend API — it has no domain logic.
- Email is a **cross-cutting concern** used by all modules (Notification, Users, Escrow, etc.).

**Verdict**: Email is an **infrastructure layer** (Ports & Adapters outer layer). Should be renamed to `infrastructure/email/` or `common/email/`.

## 3. Domain Model Audit

**No domain model** — Email is purely infrastructure.

- `SendEmailOptions` (line 3) is a DTO, not a domain entity.
- No aggregates, no invariants, no business rules.

## 4. Layering Violations

**None** — Email service is correctly positioned as infrastructure.

- However, `EmailService` is directly imported by `NotificationService` (tightly coupled).
- Recommendation: Introduce `IEmailService` interface (port), `ResendEmailService` as implementation (adapter).

## 5. Repository Pattern Gap

**Not applicable** — Email is infrastructure, not domain.

## 6. EIP Opportunities

**Adapter Pattern** (should be implemented):

- Current: `EmailService` is tightly coupled to Resend (line 10: `private resend: Resend`).
- Recommendation: Extract `IEmailService` interface:
  - `ResendEmailAdapter` implements interface.
  - Allows switching to SendGrid, AWS SES, etc., without changing callers.

**Dead Letter / Retry**:

- Current: If Resend API call fails (line 65, line 85), error bubbles up (line 69, line 90).
- Recommendation: Queue emails in BullMQ:
  - Retry 3x on failure.
  - Move to dead-letter queue after max retries.
  - Alert ops team if DLQ threshold exceeded.

**Message Translator**:

- Email templates use Resend-specific format (line 50-57: `template.id`, `template.variables`).
- Recommendation: Create `EmailTemplate` value object (domain/common):
  - `EmailTemplate` (abstract): `{ subject, body, variables }`.
  - `ResendTemplateRenderer` (infrastructure): Translates to Resend format.

## 7. Cross-Cutting Concerns

**Error handling**:

- Logs errors (line 67, line 89) and throws generic errors — good.
- Should throw custom exceptions (`EmailSendFailure`, `InvalidTemplate`).

**Logging**:

- Logs email sent (line 71, line 92) and errors (line 67, line 89) — good.

**Validation**:

- No validation of email addresses (assumes caller validates).

## 8. GraphQL-Specific Notes

**Not applicable** — Email is infrastructure, not exposed via GraphQL.

## 9. Target Structure

```
src/infrastructure/email/  # OR src/common/email/
  domain/
    IEmailService.ts                # Port (interface)
    EmailTemplate.ts                # Value object (optional)

  infrastructure/
    adapters/
      ResendEmailAdapter.ts         # Adapter (implements IEmailService)
    queues/
      EmailQueue.ts                 # BullMQ queue for async email delivery
      EmailWorker.ts                # Worker processes email jobs
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Email is infrastructure — refactoring won't break domain logic.
- Current implementation is functional (no critical bugs).

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. Email is infrastructure — refactoring doesn't unlock domain modeling.
2. Queueing emails (BullMQ) can be done independently of domain refactoring.
3. Current implementation is simple and works — low urgency.

**Migration steps**:

1. **Extract IEmailService interface** (port).
2. **Rename EmailService to ResendEmailAdapter** (adapter).
3. **Queue emails in BullMQ** (retry 3x on failure).
4. **Add email template validation** (check template exists before sending).
5. **Add email rate limiting** (prevent spam).
