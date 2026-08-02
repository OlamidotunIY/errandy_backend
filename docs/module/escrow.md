# Module: escrow

## Correction from the main architecture doc

The main doc's original summary listed `PaymentSucceeded`/`DisputeResolved` as events this module directly consumes. That's not quite right given how the flows actually got designed: `Escrow` is never created or resolved reactively by listening to those events itself — it's always **explicitly commanded** by whichever flow is orchestrating (the accept-flow's resumed `AcceptApplicationCommand` dispatches `CreateEscrowCommand`; `DisputeResolutionSaga` dispatches `ReleaseEscrowCommand`/`RefundEscrowCommand`). This module has no event-handlers of its own — just commands, called by other modules' sagas/processors.

## Folder placement

```
src/modules/escrow/
├── domain/
│   ├── entities/
│   │   └── escrow.entity.ts
│   ├── repositories/
│   │   └── escrow.repository.interface.ts
│   ├── events/
│   │   ├── escrow-created.event.ts
│   │   ├── escrow-released.event.ts
│   │   └── escrow-refunded.event.ts
│   └── errors/
│       ├── escrow-not-found.error.ts
│       └── escrow-already-finalized.error.ts
├── application/
│   ├── commands/
│   │   ├── create-escrow/
│   │   ├── release-escrow/
│   │   └── refund-escrow/
│   ├── jobs/
│   │   └── escrow-auto-release.job.ts   (queries dispute module for an open dispute before firing — a read, not a subscription)
│   └── queries/
│       └── get-escrow-by-errand-id/
├── infrastructure/
│   ├── mappers/
│   │   └── escrow.mapper.ts
│   └── repositories/
│       └── escrow.repository.ts
└── escrow.module.ts
```

## Prisma schema

```prisma
model Escrow {
  id                   String    @id @default(auto()) @map("_id") @db.ObjectId
  errandId             String    @db.ObjectId
  paymentTransactionId String    @db.ObjectId
  amount               Money
  status               String    @default("HELD")   // HELD | RELEASED | REFUNDED
  heldAt                DateTime @default(now())
  releasedAt            DateTime?
  refundedAt            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([errandId])
}
```

## Domain entity methods

**`Escrow`**
- `create(errandId, paymentTransactionId, amount)` — starts `HELD`
- `release()` → `RELEASED`, throws `EscrowAlreadyFinalizedError` if not `HELD`
- `refund()` → `REFUNDED`, same guard

## Repository interface

```typescript
abstract class IEscrowRepository {
  abstract save(escrow: Escrow): Promise<void>;
  abstract findById(id: string): Promise<Escrow | null>;
  abstract findByErrandId(errandId: string): Promise<Escrow | null>;
}
```

## DTOs

```typescript
// commands/create-escrow/create-escrow.request.dto.ts
interface CreateEscrowRequestDto {
  errandId: string;
  paymentTransactionId: string;
  amount: { amountMinorUnits: number; currency: string };
  correlationId: string;
}
interface CreateEscrowResponseDto {
  escrowId: string;
}

// commands/release-escrow/release-escrow.request.dto.ts
interface ReleaseEscrowRequestDto {
  escrowId: string;
  correlationId: string;
}

// commands/refund-escrow/refund-escrow.request.dto.ts
interface RefundEscrowRequestDto {
  escrowId: string;
  correlationId: string;
}

// queries/get-escrow-by-errand-id/get-escrow-by-errand-id.response.dto.ts
interface EscrowResponseDto {
  id: string;
  errandId: string;
  amount: { amountMinorUnits: number; currency: string };
  status: string;
  heldAt: string;
  releasedAt: string | null;
  refundedAt: string | null;
}
```

## Open items

None new.
