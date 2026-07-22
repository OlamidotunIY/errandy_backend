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
