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

**Flagging, not asserting as fact**: `findOwnersWhoTrust(partyId)` needs an index on the embedded `members.memberId`/`members.status` fields to perform well at scale. I haven't verified whether Prisma's schema language can express an index into a composite-type array field directly (`@@index([members.memberId])` may or may not be valid syntax as of the current Prisma version) — given the confirmed `2dsphere` limitation elsewhere in this project, I'd treat this the same way until checked: possibly needing the same raw-command workaround (`db.TrustedCircle.createIndex(...)`, re-asserted per deploy) rather than schema-declared.

## Domain entity methods

**`TrustedCircle`** (aggregate root)
- `addMember(memberId)` — `CONFIRMED` immediately, no gate (owner's own authority)
- `removeMember(memberId)`
- `receiveSuggestion(memberId, sharedFromPartyId)` — `SUGGESTED`, only ever called on the **target's** circle, never the sharer's
- `confirmSuggestion(memberEntryId)` — `SUGGESTED → CONFIRMED`, sets `addedAt`
- `declineSuggestion(memberEntryId)`

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

## Open items

- Prisma index support for the composite-type reverse lookup — needs verification (flagged above).
