# Module: trusted-circle

## Modeling note — composite type is still correct here, unlike chat

`TrustedCircleMember` stays a composite type embedded in `TrustedCircle` (unlike `ChatMessage`) because each *individual* circle is naturally bounded (a person realistically trusts dozens, maybe low hundreds — not thousands) even though there are many `TrustedCircle` documents system-wide. That's the right distinction: bounded-per-document embedding is fine; unbounded-per-document embedding (chat) isn't. Both are documented across their respective module files for exactly this contrast.

## Folder placement

```
src/modules/trusted-circle/
├── domain/
│   ├── entities/
│   │   └── trusted-circle.entity.ts   (TrustedCircleMember is a composite-type value shape within it)
│   ├── repositories/
│   │   └── trusted-circle.repository.interface.ts
│   ├── events/
│   │   ├── trusted-circle-member-added.event.ts
│   │   ├── trusted-circle-member-share-suggested.event.ts
│   │   ├── trusted-circle-member-confirmed.event.ts
│   │   ├── trusted-circle-member-declined.event.ts
│   │   └── trusted-circle-member-removed.event.ts
│   └── errors/
│       ├── trusted-circle-not-found.error.ts
│       ├── member-already-in-circle.error.ts
│       └── suggestion-not-found.error.ts
├── application/
│   ├── commands/
│   │   ├── add-trusted-member/
│   │   ├── remove-trusted-member/
│   │   ├── share-trusted-member/
│   │   ├── confirm-shared-member/
│   │   └── decline-shared-member/
│   ├── sagas/
│   │   └── trusted-by-count-sync.saga.ts   (trigger lives here; consumer is party)
│   └── queries/
│       ├── get-trusted-circle-by-party/
│       ├── count-mutual-trust/
│       └── list-pending-suggestions/
├── infrastructure/
│   ├── mappers/
│   │   └── trusted-circle.mapper.ts
│   └── repositories/
│       └── trusted-circle.repository.ts
└── trusted-circle.module.ts
```

## Prisma schema

```prisma
type TrustedCircleMember {
  memberId          String    @db.ObjectId   // a Party — no type field needed
  status            String    // CONFIRMED | SUGGESTED
  sharedFromPartyId String?   @db.ObjectId
  addedAt           DateTime?
}

model TrustedCircle {
  id           String                @id @default(auto()) @map("_id") @db.ObjectId
  ownerPartyId String                @unique @db.ObjectId
  members      TrustedCircleMember[]
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt
}
```

**Resolved**: rather than gamble on whether Prisma's schema language can express an index into a composite-type array field (uncertain, and the confirmed `2dsphere` limitation elsewhere in this project suggests it likely can't), `findOwnersWhoTrust(partyId)`'s index is asserted via the same raw-command workaround as the geospatial index — see the open item below.

## Domain entity methods

**`TrustedCircle`** (aggregate root)
- `addMember(memberId)` — `CONFIRMED` immediately, no gate (owner's own authority)
- `removeMember(memberId)`
- `receiveSuggestion(memberId, sharedFromPartyId)` — `SUGGESTED`, only ever called on the **target's** circle, never the sharer's
- `confirmSuggestion(memberEntryId)` — `SUGGESTED → CONFIRMED`, sets `addedAt`
- `declineSuggestion(memberEntryId)`

## Events

| Event | Raised by | Payload |
|---|---|---|
| `TrustedCircleMemberAdded` | `TrustedCircle.addMember()` | `{ circleId, memberId, correlationId }` |
| `TrustedCircleMemberShareSuggested` | `TrustedCircle.receiveSuggestion()` | `{ targetCircleId, memberId, sharedFromPartyId, correlationId }` |
| `TrustedCircleMemberConfirmed` | `TrustedCircle.confirmSuggestion()` | `{ circleId, memberId, correlationId }` |
| `TrustedCircleMemberDeclined` | `TrustedCircle.declineSuggestion()` | `{ circleId, memberId, correlationId }` |
| `TrustedCircleMemberRemoved` | `TrustedCircle.removeMember()` | `{ circleId, memberId, correlationId }` |

## Commands

| Command | Handler behavior |
|---|---|
| `AddTrustedMemberCommand` | Direct add, `CONFIRMED` immediately — owner's own authority, no gate. |
| `RemoveTrustedMemberCommand` | — |
| `ShareTrustedMemberCommand` | Loads the **sharer's own** circle, verifies the member is `CONFIRMED` there; loads/creates the **target's** circle, calls `receiveSuggestion()` — only ever mutates the target's aggregate. |
| `ConfirmSharedMemberCommand` | Own fresh `correlationId` — arbitrary delay since the share. |
| `DeclineSharedMemberCommand` | Same. |

## Event Handlers

None owned here.

## Sagas

| Saga | Trigger | Dispatches |
|---|---|---|
| `TrustedByCountSyncSaga` (trigger side — consumer lives in `party`) | `TrustedCircleMemberConfirmed`/`Removed` | No command — `party`'s consumer-side handler mutates `ProviderRole.trustedByCount` directly |

## Jobs

None.

## Repository interface

```typescript
abstract class ITrustedCircleRepository {
  abstract save(circle: TrustedCircle): Promise<void>;
  abstract findByOwnerPartyId(ownerPartyId: string): Promise<TrustedCircle | null>;
  abstract existsByOwnerAndMember(ownerPartyId: string, memberId: string): Promise<boolean>;
  abstract countMutualTrust(viewingPartyId: string, targetPartyId: string): Promise<number>;
  abstract findOwnersWhoTrust(partyId: string): Promise<string[]>;   // reverse lookup, see flag above
}
```

## DTOs

```typescript
// commands/add-trusted-member/add-trusted-member.request.dto.ts
interface AddTrustedMemberRequestDto {
  ownerPartyId: string;
  memberId: string;
}

// commands/share-trusted-member/share-trusted-member.request.dto.ts
interface ShareTrustedMemberRequestDto {
  sharerPartyId: string;
  memberId: string;
  targetPartyId: string;
}

// commands/confirm-shared-member/confirm-shared-member.request.dto.ts
interface ConfirmSharedMemberRequestDto {
  targetPartyId: string;
  memberEntryId: string;
}

// queries/get-trusted-circle-by-party/get-trusted-circle-by-party.response.dto.ts
interface TrustedCircleResponseDto {
  ownerPartyId: string;
  members: { memberId: string; status: string; sharedFromPartyId: string | null; addedAt: string | null }[];
}

// queries/count-mutual-trust/count-mutual-trust.request.dto.ts
interface CountMutualTrustRequestDto {
  viewingPartyId: string;
  targetPartyId: string;
}
interface CountMutualTrustResponseDto {
  mutualCount: number;
}

// queries/list-pending-suggestions/list-pending-suggestions.response.dto.ts
interface PendingSuggestionResponseDto {
  memberEntryId: string;
  memberId: string;
  sharedFromPartyId: string;
}
```

## Mappers

`TrustedCircleMapper` — maps the embedded `members` composite-type array into domain `TrustedCircleMember` value objects.

## Presentation

```graphql
type Mutation {
  addTrustedMember(memberId: ID!): TrustedCircle! @auth
  removeTrustedMember(memberId: ID!): TrustedCircle! @auth
  shareTrustedMember(input: ShareTrustedMemberInput!): Boolean! @auth
  confirmSharedMember(memberEntryId: ID!): TrustedCircle! @auth
  declineSharedMember(memberEntryId: ID!): TrustedCircle! @auth
}
type Query {
  myTrustedCircle: TrustedCircle! @auth
  mutualTrustCount(targetPartyId: ID!): Int! @auth
  pendingSuggestions: [PendingSuggestion!]! @auth
}
```

## Open items

- **Reverse-lookup index: resolved** — rather than depend on uncertain composite-type array indexing support, `findOwnersWhoTrust(partyId)` uses the same confirmed-necessary workaround as the geospatial index: a raw Mongo command (`db.TrustedCircle.createIndex({ "members.memberId": 1, "members.status": 1 })`) asserted in the deploy bootstrap script, re-run every deploy alongside the `2dsphere` index. No longer treated as an open question — it's the same known pattern, just applied here too.
