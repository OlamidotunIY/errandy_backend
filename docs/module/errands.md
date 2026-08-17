# Module: errands

## Folder placement

```
src/modules/errands/
├── domain/
│   ├── entities/
│   │   ├── errand.entity.ts
│   │   └── errand-assignment.entity.ts
│   ├── value-objects/
│   │   ├── errand-status.vo.ts     (DRAFT|PUBLISHED|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED|ARCHIVED)
│   │   └── source-type.vo.ts       (OPEN_BID|TRUSTED_DIRECT_ASSIGN|SERVICE_BOOKING)
│   ├── repositories/
│   │   └── errand.repository.interface.ts
│   ├── events/
│   │   ├── errand-created.event.ts
│   │   ├── errand-published.event.ts
│   │   ├── errand-assigned.event.ts
│   │   ├── errand-started.event.ts
│   │   ├── assignment-confirmed-done.event.ts
│   │   ├── assignment-confirmation-updated.event.ts
│   │   ├── errand-ready-for-completion.event.ts
│   │   ├── errand-completed.event.ts
│   │   ├── errand-cancelled.event.ts
│   │   ├── errand-relisted.event.ts
│   │   ├── assignment-removed.event.ts
│   │   └── errand-archived.event.ts
│   └── errors/
│       ├── errand-not-found.error.ts
│       ├── errand-invariant.error.ts
│       ├── errand-not-open.error.ts
│       └── not-all-assignments-confirmed.error.ts
├── application/
│   ├── commands/
│   │   ├── create-errand/
│   │   ├── publish-errand/
│   │   ├── assign-errand-to-trusted-member/
│   │   ├── offer-errand-to-trusted-member/
│   │   ├── book-service/
│   │   ├── start-errand/
│   │   ├── confirm-assignment-completion/
│   │   ├── update-assignment-confirmation/
│   │   ├── complete-errand/            (accepts both client-triggered and system/auto-accept callers — see completedBy)
│   │   ├── cancel-errand/              (dispatched by application, not called independently)
│   │   ├── relist-errand/
│   │   └── remove-assignment/          (org-internal swap, distinct from cancel)
│   ├── event-handlers/
│   │   └── (none of its own — the reactive work here is expressed as sagas below)
│   ├── sagas/
│   │   ├── chat-lifecycle.saga.ts
│   │   ├── rating-prompt.saga.ts
│   │   ├── escrow-release.saga.ts       (reclassified from "process manager")
│   │   └── escrow-refund.saga.ts
│   ├── jobs/
│   │   ├── archive-inactive-errands.job.ts    (3-month inactivity threshold)
│   │   ├── auto-accept-errand.job.ts          (24h delayed, scheduled on ErrandReadyForCompletion)
│   │   └── no-show-detection.job.ts
│   └── queries/
│       ├── browse-open-errands/         (geo + recency ranked — see docs/flows/errand-discovery-flow.md)
│       ├── get-errand-by-id/
│       ├── list-client-errands/
│       └── suggest-reassignment-candidates/
├── infrastructure/
│   ├── mappers/
│   │   └── errand.mapper.ts
│   └── repositories/
│       └── errand.repository.ts
└── errands.module.ts
```

## Prisma schema

`ErrandAssignment` is modeled as its own **collection**, not a composite type — unlike `VerificationStep`, assignments genuinely need independent querying (`findByErrandId` for the completion gate, and potentially cross-errand queries like "all of a member's active assignments" later), so a real collection with its own `_id` and indexes is the better fit here.

```prisma
model Errand {
  id                          String    @id @default(auto()) @map("_id") @db.ObjectId
  clientId                    String    @db.ObjectId   // Party — plain scalar
  serviceId                   String?   @db.ObjectId
  categoryId                  String    @db.ObjectId
  title                       String
  description                 String
  addressId                   String    @db.ObjectId
  location                    Json      // denormalized GeoJSON Point, copied from Address at creation — see errand-discovery-flow.md
  state                        String    // denormalized from Address.state — state boundaries are irregular, can't be reliably derived from a radius search, so this is an exact-match hard filter, not distance-based
  budget                      Money
  status                      String    @default("DRAFT")
  sourceType                  String    // OPEN_BID | TRUSTED_DIRECT_ASSIGN | SERVICE_BOOKING
  requiredTier                String    // ProviderTier
  marketId                    String    @db.ObjectId
  acceptedApplicationId       String?   @db.ObjectId
  workerPoolPercentageOverride Int?
  expectedStartAt             DateTime? // set at assignment time; defaults to assignedAt + 24h grace if not explicitly scheduled — drives NoShowDetectionJob
  startedAt                   DateTime?
  completedAt                 DateTime?
  completedBy                 String?   // CLIENT | SYSTEM
  cancelledAt                 DateTime?
  cancellationReason          String?   // CLIENT_CANCELLED | WORKER_CANCELLED | WORKER_NO_SHOW | SYSTEM_CANCELLED
  relistedFromErrandId        String?   @db.ObjectId
  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt

  @@index([marketId, status, categoryId])
  @@index([marketId, state, status])   // supports the hard state-boundary filter in discovery
  @@index([status, expectedStartAt])   // supports NoShowDetectionJob's scan
}
// separately, per the geospatial-index gotcha (docs/modules/address.md):
// db.Errand.createIndex({ location: "2dsphere" }) — asserted outside Prisma, on every deploy

model ErrandAssignment {
  id                       String    @id @default(auto()) @map("_id") @db.ObjectId
  errandId                 String    @db.ObjectId
  profileId                String    @db.ObjectId   // the individual Party doing the work — plain scalar
  assignedByOrganizationId String?   @db.ObjectId
  splitPercentage          Int?
  status                   String    @default("ASSIGNED")   // ASSIGNED | CONFIRMED_DONE | CANCELLED | REMOVED
  confirmedAt              DateTime?
  proofUrl                 String?
  assignedAt               DateTime  @default(now())

  @@index([errandId])
}
```

## Domain entity methods

**`Errand`** (aggregate root)
- `create(clientId, categoryId, title, description, addressId, location, budget, marketId)` — starts `DRAFT`
- `publish()` → `PUBLISHED`
- `assignTo(applicationId)` — called by the accept flow or a direct booking → `ASSIGNED`, skipping `DRAFT`/`PUBLISHED` for `SERVICE_BOOKING`; sets `expectedStartAt = now + 24h` if not otherwise scheduled
- `start()` → `IN_PROGRESS`
- `complete(completedBy: 'CLIENT' | 'SYSTEM')` — throws `NotAllAssignmentsConfirmedError` unless every `ErrandAssignment` for this errand is `CONFIRMED_DONE`
- `cancel(reason)` — `ASSIGNED → CANCELLED` only, throws `ErrandInvariantError` if `status != ASSIGNED` (this is the boundary: once `IN_PROGRESS`, cancel is no longer available — see the open item below on mid-job abandonment). Cascades: every non-terminal `ErrandAssignment` for this errand also moves to `CANCELLED` in the same transaction.
- `archive()` → `ARCHIVED`
- `relist()` — not a state transition on *this* errand at all; see `RelistErrandCommand` below, which creates a **new** `Errand` referencing this one via `relistedFromErrandId`
- Guards: `isOpen()`, `isAssigned()`, `hasStarted()`, `allAssignmentsConfirmed()` (delegates to a repository check, since assignments are a separate collection)

**`ErrandAssignment`**
- `confirmDone(proofUrl?)` — `ASSIGNED → CONFIRMED_DONE`; **no path back to `ASSIGNED`** (cannot un-confirm)
- `updateConfirmation(proofUrl)` — valid only while `status: CONFIRMED_DONE` and the parent errand isn't yet `COMPLETED`
- `cancel()` — cascaded by `Errand.cancel()`, not called independently
- `remove()` — **org-internal swap, distinct from cancel**: one member of a multi-worker org job drops out without the whole `Application`/`Errand` being cancelled. Valid while `status: ASSIGNED` (not yet confirmed), dispatched by the org itself, not the client or the platform. `ASSIGNED → REMOVED`.

## Events

| Event | Raised by | Payload |
|---|---|---|
| `ErrandCreated` | `Errand.create()` | `{ errandId, clientId, sourceType, correlationId }` |
| `ErrandPublished` | `Errand.publish()` | `{ errandId, correlationId }` |
| `ErrandAssigned` | `Errand.assignTo()` | `{ errandId, acceptedApplicationId?, correlationId }` |
| `ErrandStarted` | `Errand.start()` | `{ errandId, correlationId }` |
| `AssignmentConfirmedDone` | `ErrandAssignment.confirmDone()` | `{ errandAssignmentId, errandId, profileId, correlationId }` |
| `AssignmentConfirmationUpdated` | `ErrandAssignment.updateConfirmation()` | `{ errandAssignmentId, proofUrl, correlationId }` |
| `ErrandReadyForCompletion` | Same-transaction check after any assignment confirms | `{ errandId, correlationId }` |
| `ErrandCompleted` | `Errand.complete()` | `{ errandId, completedBy: CLIENT\|SYSTEM, correlationId }` |
| `ErrandCancelled` | `Errand.cancel()` | `{ errandId, reason, correlationId }` |
| `ErrandArchived` | `ArchiveInactiveErrandsJob` | `{ errandId, correlationId }` |
| `ErrandRelisted` | `RelistErrandCommand` handler | `{ originalErrandId, newErrandId, correlationId }` |
| `AssignmentRemoved` | `ErrandAssignment.remove()` | `{ errandAssignmentId, errandId, removedByOrganizationId, correlationId }` |

## Commands

| Command | Handler behavior |
|---|---|
| `CreateErrandCommand` | Validates `categoryId` is a leaf; stamps `requiredTier`, `marketId` from the client's `Party`. |
| `PublishErrandCommand` | `DRAFT → PUBLISHED`. |
| `AssignErrandToTrustedMemberCommand` | Creates `Errand` (`DRAFT`) **and** a `DIRECT_OFFER` `Application` in one transaction. |
| `OfferErrandToTrustedMemberCommand` | Errand already exists (post-decline) — just creates a fresh `DIRECT_OFFER` `Application`. |
| `BookServiceCommand` | Re-validates the `Service`'s current tier (not just trusted from listing time); creates `Errand` directly `ASSIGNED`. |
| `StartErrandCommand` | `ASSIGNED → IN_PROGRESS`, only the assigned member(s) may call it. |
| `ConfirmAssignmentCompletionCommand` | Guards: only the assignment's own `profileId`; only from `ASSIGNED`. Schedules `AutoAcceptErrandJob` if this was the last assignment to confirm. |
| `UpdateAssignmentConfirmationCommand` | Valid only while `CONFIRMED_DONE` and errand not yet `COMPLETED`. |
| `CompleteErrandCommand` | Guards on `NotAllAssignmentsConfirmedError`; cancels the pending `AutoAcceptErrandJob` on success. |
| `CancelErrandCommand` | Dispatched by `application`'s `CancelApplicationCommand` handler as a direct consequence, never called independently by a client. Cascades to every non-terminal `ErrandAssignment`. |
| `RelistErrandCommand` | `{ originalErrandId, updatedFields? }` — creates a **new** `Errand` (`status: DRAFT`, `relistedFromErrandId: originalErrandId`), copying `title`/`description`/`budget`/`categoryId`/`addressId` from the original unless overridden. Only valid once the original is `CANCELLED`. |
| `RemoveAssignmentCommand` | Org-internal — one member drops out of a multi-worker job without cancelling the whole engagement. Guards: `assignedByOrganizationId` matches the requester's org, `status: ASSIGNED` (not yet confirmed). |

## Event Handlers

None of its own beyond what's expressed as sagas below — `errands` is mostly a producer in this system, not a consumer, aside from the accept-flow's cross-module calls originating in `application`.

## Sagas

| Saga | Trigger | Dispatches |
|---|---|---|
| `ChatLifecycleSaga` | `ErrandAssigned` → open; `ErrandCompleted`/`ErrandCancelled` → close | `SendMessageCommand`-adjacent thread open/close (not a message, a thread lifecycle call into `chat`) |
| `RatingPromptSaga` | `ErrandCompleted` | `SendNotificationCommand` × N (client + each assigned member + org) |
| `EscrowReleaseSaga` | `ErrandCompleted` | `ReleaseEscrowCommand` |
| `EscrowRefundSaga` | `ErrandCancelled` | `RefundEscrowCommand` — valid here because `Escrow` is still `HELD` at this point (cancel only happens pre-completion, before any release), unlike the post-completion dispute case which acts on `wallet`'s pending balance instead (see `dispute.md`) |

## Jobs

| Job | Schedule | Does |
|---|---|---|
| `ArchiveInactiveErrandsJob` | Periodic (daily) | `OPEN`/`PUBLISHED` errands inactive 3+ months → `ARCHIVED` |
| `AutoAcceptErrandJob` | Delayed 24h, scheduled per-errand on `ErrandReadyForCompletion` | Idempotent no-op if already `COMPLETED`; otherwise completes with `completedBy: SYSTEM` |
| `NoShowDetectionJob` | Periodic (hourly) | Finds `Errand`s `status: ASSIGNED` past `expectedStartAt` → dispatches `CancelApplicationCommand` into `application` with `reason: WORKER_NO_SHOW`, `cancelledByPartyId: null` |

## Repository interface

```typescript
abstract class IErrandRepository {
  abstract save(errand: Errand): Promise<void>;
  abstract findById(id: string): Promise<Errand | null>;
  abstract findByClientId(clientId: string): Promise<Errand[]>;
  abstract findOpenErrands(filters: { marketId: string; categoryId?: string; requesterTier: string }): Promise<Errand[]>;
  abstract findAssignedPastStart(): Promise<Errand[]>;
  abstract findAssignedPastExpectedStart(): Promise<Errand[]>;   // supports NoShowDetectionJob
  abstract findInactiveOlderThan(date: Date): Promise<Errand[]>;

  abstract saveAssignment(assignment: ErrandAssignment): Promise<void>;
  abstract findAssignmentsByErrandId(errandId: string): Promise<ErrandAssignment[]>;
}
```

## DTOs

```typescript
// commands/create-errand/create-errand.request.dto.ts
interface CreateErrandRequestDto {
  clientId: string;
  categoryId: string;
  title: string;
  description: string;
  addressId: string;
  budget: { amountMinorUnits: number; currency: string };
}
interface CreateErrandResponseDto {
  errandId: string;
  status: 'DRAFT';
}

// commands/book-service/book-service.request.dto.ts
interface BookServiceRequestDto {
  clientId: string;
  serviceId: string;
  addressId: string;
}
interface BookServiceResponseDto {
  errandId: string;
  status: 'ASSIGNED';
}

// commands/assign-errand-to-trusted-member/assign-errand-to-trusted-member.request.dto.ts
interface AssignErrandToTrustedMemberRequestDto {
  clientId: string;
  categoryId: string;
  title: string;
  description: string;
  addressId: string;
  budget: { amountMinorUnits: number; currency: string };
  offeredToPartyId: string;
}
interface AssignErrandToTrustedMemberResponseDto {
  errandId: string;
  applicationId: string;   // the DIRECT_OFFER Application created alongside it
}

// commands/confirm-assignment-completion/confirm-assignment-completion.request.dto.ts
interface ConfirmAssignmentCompletionRequestDto {
  errandAssignmentId: string;
  profileId: string;
  proofUrl?: string;
}

// commands/update-assignment-confirmation/update-assignment-confirmation.request.dto.ts
interface UpdateAssignmentConfirmationRequestDto {
  errandAssignmentId: string;
  profileId: string;
  proofUrl: string;
}

// commands/complete-errand/complete-errand.request.dto.ts
interface CompleteErrandRequestDto {
  errandId: string;
  completedBy: 'CLIENT' | 'SYSTEM';   // SYSTEM only ever set internally by AutoAcceptErrandJob, never client-supplied
}

// commands/relist-errand/relist-errand.request.dto.ts
interface RelistErrandRequestDto {
  originalErrandId: string;
  title?: string;
  description?: string;
  budget?: { amountMinorUnits: number; currency: string };
}
interface RelistErrandResponseDto {
  newErrandId: string;
}

// commands/remove-assignment/remove-assignment.request.dto.ts
interface RemoveAssignmentRequestDto {
  errandAssignmentId: string;
  removedByOrganizationId: string;
}

// queries/browse-open-errands/browse-open-errands.request.dto.ts
interface BrowseOpenErrandsRequestDto {
  requesterPartyId: string;
  categoryId?: string;
  latitude: number;
  longitude: number;
  radiusKm?: number;   // explicit override; falls back to requester's defaultSearchRadiusKm, then to state-boundary-only
  limit: number;
  cursor?: string;
}
// queries/browse-open-errands/browse-open-errands.response.dto.ts
interface ErrandSummaryResponseDto {
  id: string;
  title: string;
  categoryId: string;
  budget: { amountMinorUnits: number; currency: string };
  distanceMeters: number;
  createdAt: string;
}

// queries/suggest-reassignment-candidates/suggest-reassignment-candidates.response.dto.ts
interface ReassignmentCandidateResponseDto {
  partyId: string;
  name: string | null;
  tier: string;
  avgRatingCached: number | null;
  trustedByCount: number;
  fromCircle: boolean;
}
```

## Mappers

`ErrandMapper`
- `toDomain(prismaErrand)` / `toPersistence(errand)` — includes `Money` and GeoJSON `location` conversions
- `ErrandAssignmentMapper` — separate, since `ErrandAssignment` is its own collection

## Presentation

```graphql
type Mutation {
  createErrand(input: CreateErrandInput!): Errand! @auth
  publishErrand(errandId: ID!): Errand! @auth
  assignErrandToTrustedMember(input: AssignErrandToTrustedMemberInput!): AssignErrandToTrustedMemberResult! @auth
  offerErrandToTrustedMember(input: OfferErrandToTrustedMemberInput!): Application! @auth
  bookService(input: BookServiceInput!): BookServiceResult! @auth
  startErrand(errandId: ID!): Errand! @auth
  confirmAssignmentCompletion(input: ConfirmAssignmentCompletionInput!): ErrandAssignment! @auth
  updateAssignmentConfirmation(input: UpdateAssignmentConfirmationInput!): ErrandAssignment! @auth
  completeErrand(errandId: ID!): Errand! @auth
  relistErrand(input: RelistErrandInput!): RelistErrandResult! @auth
  removeAssignment(input: RemoveAssignmentInput!): Boolean! @auth(role: ["OWNER", "ADMIN"])
}
type Query {
  browseOpenErrands(input: BrowseOpenErrandsInput!): [ErrandSummary!]! @auth
  errand(id: ID!): Errand @auth
  myErrands: [Errand!]! @auth
  reassignmentCandidates(errandId: ID!): [ReassignmentCandidate!]! @auth
}
```

`completeErrand`'s resolver always sends `completedBy: CLIENT` — the `SYSTEM` value is only ever set internally by `AutoAcceptErrandJob`, never reachable through this field. `cancelErrand` has **no `Mutation` field at all** — it's always dispatched internally by `application`'s `CancelApplicationCommand` handler; the client-facing action is cancelling the *application*, which cascades here, not calling this directly.

## Open items carried forward

- `sourceType` mutability — **resolved**, immutable, see `errand-creation-flow.md`.
- Dispute-window relative to `completedBy` — **resolved**, no differential treatment, see `errand-completion-flow.md`.
- **New gap surfaced by Cancel's design**: once `IN_PROGRESS`, there's no path to stop a job — `cancel()` only works pre-start, and disputes only cover post-completion. A job abandoned mid-way currently has nowhere to go. Flagging as a real hole, not solving it here.
