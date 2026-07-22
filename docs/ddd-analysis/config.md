# Config — DDD & EIP Analysis

## 1. Current Responsibility

GraphQL WebSocket configuration:

- **GraphQL WebSocket**: `graphql-ws.ts` configures GraphQL subscriptions via WebSocket.

**Files**: `graphql-ws.ts`.

## 2. Bounded Context Assessment

**This is infrastructure configuration**, NOT a bounded context.

- Config is a **technical concern** (framework configuration) — no domain logic.

**Verdict**: Config is an **infrastructure layer**. Should contain only configuration files (no domain logic).

## 3. Domain Model Audit

**No domain model** — Config is purely infrastructure (framework configuration).

## 4. Layering Violations

**Should contain NO domain logic**:

- If domain logic exists in Config (e.g., business rules in config files), that's a violation.
- Recommendation: Audit Config directory — move any domain logic to appropriate modules.

## 5. Repository Pattern Gap

**Not applicable** — Config is infrastructure, not domain.

## 6. EIP Opportunities

**None** — Config is infrastructure (configuration doesn't fit EIP patterns).

## 7. Cross-Cutting Concerns

**Security**:

- GraphQL WebSocket configuration should include authentication (validate JWT tokens on WebSocket connection).

**Logging**:

- Log WebSocket connections/disconnections for debugging.

## 8. GraphQL-Specific Notes

**GraphQL subscriptions**:

- `graphql-ws.ts` configures WebSocket server for GraphQL subscriptions (real-time updates).
- Should validate user authentication on WebSocket connection (before subscriptions start).

## 9. Target Structure

```
src/config/
  graphql-ws.ts                 # GraphQL WebSocket configuration
  database.config.ts            # Database connection config (if needed)
  app.config.ts                 # Application config (port, environment, etc.)
```

**Recommendation**: Only keep configuration in Config. No domain logic.

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Config is infrastructure — refactoring won't break domain logic (if no domain logic exists in Config).

**Priority**: **PHASE 3 (audit only)**
**Rationale**:

1. Config should only contain configuration — audit to ensure no domain logic leaked in.
2. GraphQL WebSocket config is presentation layer — refactor after domain refactoring is complete.

**Migration steps**:

1. **Audit Config directory** — move any domain logic to appropriate modules.
2. **Add authentication** to GraphQL WebSocket (validate JWT on connection).
3. **Add logging** (WebSocket connection events).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Technical policy object for GraphQL WebSocket connection requirements.
 * // TODO: No dedicated Prisma model currently stores WS policy state.
 */
class GraphqlWsPolicy {
  constructor(
    public readonly requireAuth: boolean,
    public readonly closeCodeOnUnauthorized: number,
  );

  /**
   * Validates that connection metadata has an auth token when requireAuth = true.
   */
  validateConnectionParams(params: Record<string, unknown>): void;
}
```

### Repository Interface

```typescript
/**
 * Configuration source abstraction for runtime websocket settings.
 */
interface IConfigRepository {
  /**
   * Returns GraphQL websocket configuration values.
   */
  getGraphqlWsPolicy(): Promise<GraphqlWsPolicy>;
}
```

### Application Layer

```typescript
/**
 * Handles websocket connection authentication checks.
 */
class ValidateWsConnectionCommandHandler {
  /**
   * Validates connection parameters against GraphqlWsPolicy.
   */
  execute(command: ValidateWsConnectionCommand): Promise<void>;
}

interface ValidateWsConnectionCommand {
  connectionParams: Record<string, unknown>;
}
```

### Domain Events

```typescript
/**
 * Emitted when websocket client connection is accepted.
 */
class WsClientConnectedEvent {
  constructor(
    public readonly userId: UserId | null,
    public readonly connectedAt: Date,
  );
}

/**
 * Emitted when websocket client connection is rejected.
 */
class WsClientRejectedEvent {
  constructor(
    public readonly reason: string,
    public readonly rejectedAt: Date,
  );
}
```
