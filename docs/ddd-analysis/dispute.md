# Dispute — DDD & EIP Analysis

## 1. Current Responsibility

**Module is a stub** — `DisputeService` is empty (3 lines, no methods).

- Likely planned feature for dispute resolution (errand conflicts, payment disputes).

**Files**: `dispute.service.ts` (empty), `dispute.module.ts`, `entities/` (Prisma model exists).

## 2. Bounded Context Assessment

**This should be a separate bounded context** for "Dispute Resolution" or "Conflict Management".

- Dispute is a **complex domain** if fully implemented:
  - Dispute lifecycle: Open → Under Review → Evidence Submitted → Resolved → Closed.
  - Stakeholders: Client, Provider, Admin (mediator).
  - Outcomes: Refund, Partial refund, Favor provider, Favor client.

**Overlaps**:

- **Errands**: Disputes are linked to errands (`dispute.errandId`).
- **Escrow**: Dispute resolution affects escrow (release funds to provider or refund to client).
- **Users**: Dispute involves client and provider (reputation impact).

**Verdict**: Dispute is a **separate bounded context** (do not merge with Errands/Escrow). Implement as saga (orchestrates Errand + Escrow + User updates based on resolution).

## 3. Domain Model Audit

**Prisma model likely exists** (in prisma/model/dispute.prisma):

- `Dispute`: `{ id, errandId, clientId, providerId, reason, status, resolution, createdAt, resolvedAt }`.

**Proposed aggregate**:

- **`Dispute`** aggregate root with:
  - Methods: `Dispute.open()`, `Dispute.submitEvidence()`, `Dispute.resolve(outcome)`, `Dispute.close()`.
  - Invariants: Dispute must be linked to errand, only one open dispute per errand, resolution requires evidence.

## 4. Layering Violations

**Not applicable** — service is empty.

## 5. Repository Pattern Gap

**Proposed**:

```
domain/
  IDisputeRepository (interface)
    - findById(id): Dispute | null
    - findByErrand(errandId): Dispute[]
    - save(dispute): void
```

## 6. EIP Opportunities

**Saga Pattern**:

- Dispute resolution is a **saga** (multi-step workflow):
  1. Admin reviews dispute.
  2. Admin requests evidence from client and provider.
  3. Admin makes resolution decision (favor client or provider).
  4. If favor client: Escrow refunds client, Errand status set to DISPUTED_REFUNDED.
  5. If favor provider: Escrow releases to provider, Errand status set to DISPUTED_COMPLETED.
  6. Reputation scores updated (if resolution affects ratings).

**Command/Event patterns**:

1. **DisputeOpened event**:
   - When client/provider opens dispute, emit event.
   - Listeners:
     - Escrow puts funds on hold (freeze escrow).
     - Notification sends "dispute opened" alert to both parties + admin.

2. **DisputeResolved event**:
   - When admin resolves dispute, emit event.
   - Listeners:
     - Escrow releases or refunds (based on resolution).
     - Errand updates status.
     - Notification sends resolution outcome to parties.

## 7. Cross-Cutting Concerns

**Not applicable** — service is empty.

## 8. GraphQL-Specific Notes

**Authorization**:

- Only client, provider, or admin can view dispute details.
- Only admin can resolve dispute.

## 9. Target Structure

```
src/dispute/
  domain/
    entities/
      Dispute.ts                    # Aggregate root with open(), resolve(), close()
    value-objects/
      DisputeStatus.ts              # OPEN | UNDER_REVIEW | RESOLVED | CLOSED
      DisputeResolution.ts          # FAVOR_CLIENT | FAVOR_PROVIDER | PARTIAL_REFUND
    repositories/
      IDisputeRepository.ts
    events/
      DisputeOpened.ts
      DisputeResolved.ts

  application/
    commands/
      OpenDispute/
        OpenDisputeCommand.ts
        OpenDisputeHandler.ts       # Open dispute, freeze escrow, notify parties
      ResolveDispute/
        ResolveDisputeCommand.ts
        ResolveDisputeHandler.ts    # Resolve dispute, release/refund escrow
    sagas/
      DisputeResolutionSaga.ts      # Orchestrates: resolve → escrow action → errand update → reputation update

  infrastructure/
    repositories/
      PrismaDisputeRepository.ts

  presentation/
    resolvers/
      DisputeResolver.ts
```

## 10. Migration Risk & Priority

**Risk**: **LOW** (module is empty, no existing functionality to break).

**Priority**: **PHASE 3 (after core domain modules) OR DEFER**
**Rationale**:

1. Dispute is not implemented — can defer until MVP is stable.
2. Dispute resolution is a complex domain — requires admin panel, evidence management, etc.
3. If dispute is in MVP, implement in Phase 3 (after Errands/Escrow are stable).

**Migration steps** (if implementing):

1. **Extract Dispute aggregate** with `open()`, `resolve()`, `close()` methods.
2. **Introduce IDisputeRepository** and `PrismaDisputeRepository`.
3. **Create command handlers** (OpenDispute, ResolveDispute).
4. **Emit events**: `DisputeOpened`, `DisputeResolved`.
5. **Create DisputeResolutionSaga** (orchestrates escrow release/refund based on resolution).
6. **Add admin panel** for dispute management (review evidence, make decisions).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Dispute aggregate for conflict resolution workflow.
 * Maps to Dispute fields: id, errandId, clientId, workerId, status, reason, createdAt.
 */
class DisputeId extends EntityId {
  /**
   * Private constructor. Use DisputeId.new() or DisputeId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new DisputeId.
   */
  static new(): DisputeId;

  /**
   * Rehydrates DisputeId from persisted value.
   */
  static from(value: string): DisputeId;
}

/**
 * Dispute aggregate for conflict resolution workflow.
 */
class Dispute extends AggregateRoot<DisputeId> {
  constructor(
    public readonly id: DisputeId,
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly workerId: ProviderId,
    private status: DisputeStatus,
    public readonly reason: string,
    public readonly createdAt: Date,
  );

  /**
   * Opens a new dispute in PENDING status.
   */
  static create(errandId: ErrandId, clientId: ClientId, workerId: ProviderId, reason: string): Dispute;

  /**
   * Reconstitutes dispute aggregate from persistence.
   */
  static reconstitute(
    id: DisputeId,
    errandId: ErrandId,
    clientId: ClientId,
    workerId: ProviderId,
    status: DisputeStatus,
    reason: string,
    createdAt: Date,
  ): Dispute;

  /**
   * Accepts a dispute after review.
   * Transition: PENDING -> ACCEPTED.
   */
  accept(): void;

  /**
   * Rejects a dispute after review.
   * Transition: PENDING -> REJECTED.
   */
  reject(): void;
}
```

### Repository Interface

```typescript
/**
 * Persistence contract for Dispute aggregate.
 */
interface IDisputeRepository {
  /**
   * Reads dispute by Dispute.id.
   */
  findById(id: DisputeId): Promise<Dispute | null>;

  /**
   * Reads disputes by errandId.
   */
  findByErrandId(errandId: ErrandId): Promise<Dispute[]>;

  /**
   * Reads current open dispute for an errand if present.
   */
  findPendingByErrandId(errandId: ErrandId): Promise<Dispute | null>;

  /**
   * Saves status updates and reason metadata.
   */
  save(dispute: Dispute): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Opens a dispute for an errand participant.
 */
class OpenDisputeCommandHandler {
  /**
   * Creates dispute and emits DisputeOpenedEvent.
   */
  execute(command: OpenDisputeCommand): Promise<DisputeId>;
}

interface OpenDisputeCommand {
  errandId: ErrandId;
  openedByUserId: UserId;
  reason: string;
}

/**
 * Resolves a pending dispute by admin action.
 */
class ResolveDisputeCommandHandler {
  /**
   * Updates Dispute.status and emits DisputeResolvedEvent.
   */
  execute(command: ResolveDisputeCommand): Promise<void>;
}

interface ResolveDisputeCommand {
  disputeId: DisputeId;
  resolverUserId: UserId;
  resolution: 'ACCEPTED' | 'REJECTED';
}
```

### Domain Events

```typescript
/**
 * Emitted when a dispute is opened.
 */
class DisputeOpenedEvent {
  constructor(
    public readonly disputeId: DisputeId,
    public readonly errandId: ErrandId,
    public readonly clientId: ClientId,
    public readonly workerId: ProviderId,
  );
}

/**
 * Emitted when a dispute is resolved.
 */
class DisputeResolvedEvent {
  constructor(
    public readonly disputeId: DisputeId,
    public readonly errandId: ErrandId,
    public readonly status: DisputeStatus,
  );
}
```
