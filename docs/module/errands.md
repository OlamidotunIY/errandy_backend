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
│   │   └── complete-errand/            (accepts both client-triggered and system/auto-accept callers — see completedBy)
│   ├── event-handlers/
│   │   └── (none of its own — the reactive work here is expressed as sagas below)
│   ├── sagas/
│   │   ├── chat-lifecycle.saga.ts
│   │   ├── rating-prompt.saga.ts
│   │   ├── escrow-release.saga.ts       (reclassified from "process manager")
│   │   └── escrow-refund.saga.ts        (deferred, pairs with cancel)
│   ├── jobs/
│   │   ├── archive-inactive-errands.job.ts    (3-month inactivity threshold)
│   │   └── auto-accept-errand.job.ts          (24h delayed, scheduled on ErrandReadyForCompletion)
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
  budget                      Money
  status                      String    @default("DRAFT")
  sourceType                  String    // OPEN_BID | TRUSTED_DIRECT_ASSIGN | SERVICE_BOOKING
  requiredTier                String    // ProviderTier
  marketId                    String    @db.ObjectId
  acceptedApplicationId       String?   @db.ObjectId
  workerPoolPercentageOverride Int?
  startedAt                   DateTime?
  completedAt                 DateTime?
  completedBy                 String?   // CLIENT | SYSTEM
  cancelledAt                 DateTime?
  relistedFromErrandId        String?   @db.ObjectId
  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt

  @@index([marketId, status, categoryId])
}
// separately, per the geospatial-index gotcha (docs/modules/address.md):
// db.Errand.createIndex({ location: "2dsphere" }) — asserted outside Prisma, on every deploy

model ErrandAssignment {
  id                       String    @id @default(auto()) @map("_id") @db.ObjectId
  errandId                 String    @db.ObjectId
  profileId                String    @db.ObjectId   // the individual Party doing the work — plain scalar
  assignedByOrganizationId String?   @db.ObjectId
  splitPercentage          Int?
  status                   String    @default("ASSIGNED")   // ASSIGNED | CONFIRMED_DONE
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
- `assignTo(applicationId)` — called by the accept flow or a direct booking → `ASSIGNED`, skipping `DRAFT`/`PUBLISHED` for `SERVICE_BOOKING`
- `start()` → `IN_PROGRESS`
- `complete(completedBy: 'CLIENT' | 'SYSTEM')` — throws `NotAllAssignmentsConfirmedError` unless every `ErrandAssignment` for this errand is `CONFIRMED_DONE`
- `archive()` → `ARCHIVED`
- Guards: `isOpen()`, `isAssigned()`, `hasStarted()`, `allAssignmentsConfirmed()` (delegates to a repository check, since assignments are a separate collection)

**`ErrandAssignment`**
- `confirmDone(proofUrl?)` — `ASSIGNED → CONFIRMED_DONE`; **no path back to `ASSIGNED`** (cannot un-confirm)
- `updateConfirmation(proofUrl)` — valid only while `status: CONFIRMED_DONE` and the parent errand isn't yet `COMPLETED`

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
| `ErrandArchived` | `ArchiveInactiveErrandsJob` | `{ errandId, correlationId }` |

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

## Event Handlers

None of its own beyond what's expressed as sagas below — `errands` is mostly a producer in this system, not a consumer, aside from the accept-flow's cross-module calls originating in `application`.

## Sagas

| Saga | Trigger | Dispatches |
|---|---|---|
| `ChatLifecycleSaga` | `ErrandAssigned` → open; `ErrandCompleted`/`ErrandCancelled` → close | `SendMessageCommand`-adjacent thread open/close (not a message, a thread lifecycle call into `chat`) |
| `RatingPromptSaga` | `ErrandCompleted` | `SendNotificationCommand` × N (client + each assigned member + org) |
| `EscrowReleaseSaga` | `ErrandCompleted` | `ReleaseEscrowCommand` |
| `EscrowRefundSaga` *(deferred)* | `ErrandCancelled` | `RefundEscrowCommand` |

## Jobs

| Job | Schedule | Does |
|---|---|---|
| `ArchiveInactiveErrandsJob` | Periodic (daily) | `OPEN`/`PUBLISHED` errands inactive 3+ months → `ARCHIVED` |
| `AutoAcceptErrandJob` | Delayed 24h, scheduled per-errand on `ErrandReadyForCompletion` | Idempotent no-op if already `COMPLETED`; otherwise completes with `completedBy: SYSTEM` |
| `NoShowDetectionJob` *(deferred)* | — | Depends on cancel |

## Repository interface

```typescript
abstract class IErrandRepository {
  abstract save(errand: Errand): Promise<void>;
  abstract findById(id: string): Promise<Errand | null>;
  abstract findByClientId(clientId: string): Promise<Errand[]>;
  abstract findOpenErrands(filters: { marketId: string; categoryId?: string; requesterTier: string }): Promise<Errand[]>;
  abstract findAssignedPastStart(): Promise<Errand[]>;
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

// queries/browse-open-errands/browse-open-errands.request.dto.ts
interface BrowseOpenErrandsRequestDto {
  requesterPartyId: string;
  categoryId?: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
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
}
type Query {
  browseOpenErrands(input: BrowseOpenErrandsInput!): [ErrandSummary!]! @auth
  errand(id: ID!): Errand @auth
  myErrands: [Errand!]! @auth
  reassignmentCandidates(errandId: ID!): [ReassignmentCandidate!]! @auth
}
```

`completeErrand`'s resolver always sends `completedBy: CLIENT` — the `SYSTEM` value is only ever set internally by `AutoAcceptErrandJob`, never reachable through this field.

## Open items carried forward

- `sourceType` mutability after a declined direct-offer gets published — see main doc.
- Dispute-window relative to `completedBy` — see main doc.
