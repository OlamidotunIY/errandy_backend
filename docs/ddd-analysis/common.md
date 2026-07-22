# Common — DDD & EIP Analysis

## 1. Current Responsibility

Shared exception filters:

- **Filters**: `filters/` directory contains exception filters (HTTP exception handling for NestJS).

**Files**: `filters/` (exception filters).

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- Common is a **technical concern** (cross-cutting HTTP error handling) — no domain logic.
- Common is typically used for shared utilities, filters, guards, decorators.

**Verdict**: Common is an **infrastructure layer**. Should contain only technical/cross-cutting concerns (no domain logic).

## 3. Domain Model Audit

**No domain model** — Common is purely infrastructure (exception filters).

- Exception filters are HTTP-specific (presentation layer).

## 4. Layering Violations

**Should contain NO domain logic**:

- If domain logic exists in Common (e.g., business rules in utility functions), that's a violation.
- Recommendation: Audit Common directory — move any domain logic to appropriate modules.

## 5. Repository Pattern Gap

**Not applicable** — Common is infrastructure, not domain.

## 6. EIP Opportunities

**None** — Common is infrastructure (exception filters don't fit EIP patterns).

## 7. Cross-Cutting Concerns

**Error handling**:

- Exception filters standardize error responses (GraphQL errors, HTTP errors).
- Recommendation: Ensure domain exceptions (e.g., `InvalidErrand`, `InsufficientFunds`) are mapped to appropriate HTTP status codes (400, 409, etc.).

**Logging**:

- Exception filters should log errors for debugging (stack trace, user ID, request context).

## 8. GraphQL-Specific Notes

**GraphQL exception filter**:

- GraphQL errors should be formatted consistently (error code, message, stack trace in dev mode).

## 9. Target Structure

```
src/common/
  filters/
    HttpExceptionFilter.ts      # HTTP exception handling
    GraphQLExceptionFilter.ts   # GraphQL exception handling
  decorators/
    CurrentUser.ts              # GraphQL decorator for extracting user from context
  guards/
    AuthGuard.ts                # Authentication guard
```

**Recommendation**: Only keep technical/cross-cutting concerns in Common. No domain logic.

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Common is infrastructure — refactoring won't break domain logic (if no domain logic exists in Common).

**Priority**: **PHASE 3 (audit only)**
**Rationale**:

1. Common should only contain technical concerns — audit to ensure no domain logic leaked in.
2. Exception filters are presentation layer — refactor after domain refactoring is complete.

**Migration steps**:

1. **Audit Common directory** — move any domain logic to appropriate modules.
2. **Standardize exception filters** (map domain exceptions to HTTP status codes).
3. **Add logging** (exception filters should log errors for debugging).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Technical value object for normalized error envelopes returned by filters.
 * // TODO: No dedicated Prisma model currently stores this envelope.
 */
class ErrorEnvelope {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly traceId: string | null,
    public readonly occurredAt: Date,
  );

  /**
   * Returns error payload shape that is consistent across HTTP and GraphQL adapters.
   */
  toResponseBody(): { code: string; message: string; traceId: string | null };
}
```

### Repository Interface

```typescript
/**
 * Optional repository for persisted exception audit entries.
 * // TODO: Decide whether to map to WebhookEvent(id, eventId, provider, eventType, data, createdAt)
 * // TODO: or introduce a dedicated ErrorAudit model.
 */
interface IErrorAuditRepository {
  /**
   * Persists a normalized error envelope for operational troubleshooting.
   */
  save(envelope: ErrorEnvelope): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Maps domain/application exceptions into transport-safe response payloads.
 */
class MapExceptionToEnvelopeHandler {
  /**
   * Creates ErrorEnvelope with stable error code and optional trace id.
   */
  execute(exception: unknown): ErrorEnvelope;
}

/**
 * Records exception envelope for asynchronous monitoring.
 */
class RecordExceptionAuditHandler {
  /**
   * Persists envelope using IErrorAuditRepository when configured.
   */
  execute(envelope: ErrorEnvelope): Promise<void>;
}
```

### Domain Events

```typescript
/**
 * Emitted when transport layer catches and normalizes an exception.
 */
class ExceptionMappedEvent {
  constructor(
    public readonly code: string,
    public readonly traceId: string | null,
    public readonly occurredAt: Date,
  );
}
```
