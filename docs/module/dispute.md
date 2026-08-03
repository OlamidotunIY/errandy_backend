# Module: dispute

## Alignment with wallet's pending-window (discovered while reviewing `wallet.md`)

`EscrowReleaseSaga` moves funds out of `Escrow` immediately on `ErrandCompleted` — it doesn't wait for a dispute window. By the time most disputes would be raised, `Escrow` is already `RELEASED`, so calling `Escrow.refund()` would throw `EscrowAlreadyFinalizedError`. The actual protection against late disputes now lives in `wallet`'s `PENDING` balance bucket (a 7-day hold after release, before funds become withdrawable — see `docs/modules/wallet.md`).

This means dispute eligibility and the wallet's pending window are the **same window — decided at 7 days** (matching `wallet.md`'s `ReleasePendingWindowJob`), and `DisputeResolutionSaga` needs a branch:
- **Resolved within the window** → dispatches `ReversePendingCommand` into `wallet` (writes `PENDING_REVERSAL`, no `AVAILABLE_CREDIT`), **not** `RefundEscrowCommand`.
- **Resolved in the party's favor** → no action needed — the existing `PENDING_CREDIT` proceeds to `AVAILABLE` normally.
- `Escrow.refund()`/`RefundEscrowCommand` now only apply to the deferred pre-completion cancel path.

`OpenDisputeCommand`'s guard is updated: `ErrandNotEligibleForDisputeError` if `Errand.status != COMPLETED` **or** if the pending window has already elapsed (a cross-module read into `wallet`).

## Folder placement

```
src/modules/dispute/
├── domain/
│   ├── entities/
│   │   └── dispute.entity.ts
│   ├── repositories/
│   │   └── dispute.repository.interface.ts
│   ├── events/
│   │   ├── dispute-opened.event.ts
│   │   ├── dispute-under-review.event.ts
│   │   ├── dispute-resolved.event.ts
│   │   └── dispute-rejected.event.ts
│   └── errors/
│       ├── dispute-not-found.error.ts
│       ├── dispute-already-resolved.error.ts
│       └── errand-not-eligible-for-dispute.error.ts
├── application/
│   ├── commands/
│   │   ├── open-dispute/
│   │   ├── assign-reviewer/         (permission-checked: dispute:assign-reviewer)
│   │   ├── resolve-dispute/         (permission-checked: dispute:resolve)
│   │   └── reject-dispute/          (permission-checked: dispute:reject)
│   ├── sagas/
│   │   └── dispute-resolution.saga.ts   (reclassified — single conditional hop, no compensation)
│   └── queries/
│       ├── get-dispute-by-id/
│       └── list-open-disputes/
├── infrastructure/
│   ├── adapters/
│   │   └── document-storage.adapter.ts   (evidence uploads — Claim Check pattern)
│   ├── mappers/
│   │   └── dispute.mapper.ts
│   └── repositories/
│       └── dispute.repository.ts
└── dispute.module.ts
```

## Prisma schema

`resolvedById` is a raw better-auth user id — a plain string, not a reference to any aggregate we own (admins never get a `Party`, per the main doc's Integration Concerns section).

```prisma
model Dispute {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  errandId      String    @db.ObjectId
  raisedById    String    @db.ObjectId   // Party — plain scalar
  reason        String
  description   String
  evidenceUrls  String[]  @default([])
  status        String    @default("OPEN")   // OPEN | UNDER_REVIEW | RESOLVED | REJECTED
  resolution    String?
  resolvedById  String?                       // better-auth admin user id, not a Party
  resolvedAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([status])
  @@index([errandId])
}
```

## Domain entity methods

**`Dispute`**
- `open(errandId, raisedById, reason, description)` — static factory; the command handler checks `Errand.status = COMPLETED` **before** calling this (throws `ErrandNotEligibleForDisputeError` otherwise — this is enforced at the handler level since it needs a cross-module read of `Errand`, not something `Dispute` itself can check)
- `assignReviewer(reviewerId)` → `UNDER_REVIEW`
- `resolve(resolution, resolvedById)` → `RESOLVED`, throws `DisputeAlreadyResolvedError` if not `OPEN`/`UNDER_REVIEW`
- `reject(resolvedById, reason)` → `REJECTED`

## Events

| Event | Raised by | Payload |
|---|---|---|
| `DisputeOpened` | `Dispute.open()` | `{ disputeId, errandId, correlationId }` |
| `DisputeUnderReview` | `Dispute.assignReviewer()` | `{ disputeId, reviewerId, correlationId }` |
| `DisputeResolved` | `Dispute.resolve()` | `{ disputeId, errandId, resolution, correlationId }` |
| `DisputeRejected` | `Dispute.reject()` | `{ disputeId, correlationId }` |

## Commands

| Command | Handler behavior |
|---|---|
| `OpenDisputeCommand` | Cross-module read of `Errand.status` first — `ErrandNotEligibleForDisputeError` unless `COMPLETED`. |
| `AssignReviewerCommand` | Permission-checked (`dispute:assign-reviewer`). |
| `ResolveDisputeCommand` | Permission-checked (`dispute:resolve`). Fresh `correlationId` — arbitrary delay since opening. |
| `RejectDisputeCommand` | Permission-checked (`dispute:reject`). |

## Event Handlers

None owned here.

## Sagas

| Saga | Trigger | Dispatches |
|---|---|---|
| `DisputeResolutionSaga` | `DisputeResolved` | `ReversePendingCommand` into `wallet` if resolved against the party (within the pending window); no action if resolved in the party's favor. `RefundEscrowCommand` is no longer dispatched from here — see the alignment note above. |

## Jobs

None.

## Repository interface

```typescript
abstract class IDisputeRepository {
  abstract save(dispute: Dispute): Promise<void>;
  abstract findById(id: string): Promise<Dispute | null>;
  abstract findByErrandId(errandId: string): Promise<Dispute | null>;
  abstract findOpen(errandId: string): Promise<Dispute | null>;   // used by EscrowAutoReleaseJob's check
}
```

## DTOs

```typescript
// commands/open-dispute/open-dispute.request.dto.ts
interface OpenDisputeRequestDto {
  errandId: string;
  raisedById: string;
  reason: string;
  description: string;
  evidenceUrls?: string[];
}
interface OpenDisputeResponseDto {
  disputeId: string;
}

// commands/assign-reviewer/assign-reviewer.request.dto.ts
interface AssignReviewerRequestDto {
  disputeId: string;
  reviewerId: string;   // better-auth admin id
}

// commands/resolve-dispute/resolve-dispute.request.dto.ts
interface ResolveDisputeRequestDto {
  disputeId: string;
  resolution: string;
  resolvedById: string;
}

// commands/reject-dispute/reject-dispute.request.dto.ts
interface RejectDisputeRequestDto {
  disputeId: string;
  resolvedById: string;
  reason: string;
}

// queries/get-dispute-by-id/get-dispute-by-id.response.dto.ts
interface DisputeResponseDto {
  id: string;
  errandId: string;
  raisedById: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
}

// queries/list-open-disputes/list-open-disputes.response.dto.ts
// returns DisputeResponseDto[], admin-facing only
```

## Mappers

`DisputeMapper` — thin `toDomain`/`toPersistence`.

## Presentation

```graphql
type Mutation {
  openDispute(input: OpenDisputeInput!): Dispute! @auth
  assignReviewer(input: AssignReviewerInput!): Dispute! @auth(permission: "dispute:assign-reviewer")
  resolveDispute(input: ResolveDisputeInput!): Dispute! @auth(permission: "dispute:resolve")
  rejectDispute(input: RejectDisputeInput!): Dispute! @auth(permission: "dispute:reject")
}
type Query {
  dispute(id: ID!): Dispute @auth
  openDisputes: [Dispute!]! @auth(permission: "dispute:assign-reviewer")
}
```

## Open items

None new — timing (`COMPLETED`-only) already resolved in `docs/flows/dispute-flow.md`.
