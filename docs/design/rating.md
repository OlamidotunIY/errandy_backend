# Module: rating

## Folder placement

```
src/modules/rating/
├── domain/
│   ├── entities/
│   │   └── rating.entity.ts
│   ├── value-objects/
│   │   └── rating-context.vo.ts   (CLIENT_FACING | INTERNAL)
│   ├── repositories/
│   │   └── rating.repository.interface.ts
│   ├── events/
│   │   └── rating-submitted.event.ts
│   └── errors/
│       ├── rating-already-submitted.error.ts
│       └── rating-not-allowed.error.ts
├── application/
│   └── commands/
│       └── submit-rating/
├── application/queries/
│   ├── get-average-rating-by-ratee/
│   └── list-ratings-for-ratee/
├── infrastructure/
│   ├── mappers/
│   │   └── rating.mapper.ts
│   └── repositories/
│       └── rating.repository.ts
└── rating.module.ts
```

## Prisma schema

```prisma
model Rating {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  errandId  String   @db.ObjectId
  raterId   String   @db.ObjectId   // Party — plain scalar
  rateeId   String   @db.ObjectId   // Party — plain scalar
  context   String   // CLIENT_FACING | INTERNAL
  score     Int      // 1–5
  comment   String?  // CLIENT_FACING only — never populated for INTERNAL
  createdAt DateTime @default(now())

  @@unique([errandId, raterId, rateeId, context])
  @@index([rateeId, context])
}
```

## Domain entity methods

**`Rating`**
- `submit(errandId, raterId, rateeId, context, score, comment?)` — static factory; throws if `comment` is provided alongside `context: INTERNAL` (validation, not silent dropping — see open item below, since this was previously undecided and I'm resolving it here as the more defensive default: reject rather than silently discard)

## Repository interface

```typescript
abstract class IRatingRepository {
  abstract save(rating: Rating): Promise<void>;
  abstract findById(id: string): Promise<Rating | null>;
  abstract findByRateeId(rateeId: string, context: 'CLIENT_FACING' | 'INTERNAL', pagination: { limit: number; cursor?: string }): Promise<{ items: Rating[]; nextCursor?: string }>;
  abstract existsForErrandRaterRatee(errandId: string, raterId: string, rateeId: string, context: string): Promise<boolean>;
}
```

## DTOs

```typescript
// commands/submit-rating/submit-rating.request.dto.ts
interface SubmitRatingRequestDto {
  errandId: string;
  raterId: string;
  rateeId: string;
  context: 'CLIENT_FACING' | 'INTERNAL';
  score: number;         // 1–5
  comment?: string;      // rejected with a validation error if context is INTERNAL
}
interface SubmitRatingResponseDto {
  ratingId: string;
}

// queries/get-average-rating-by-ratee/get-average-rating-by-ratee.response.dto.ts
interface AverageRatingResponseDto {
  rateeId: string;
  averageScore: number | null;   // recency-weighted, CLIENT_FACING only — see docs/flows/rating-flow.md
  ratingCount: number;
}

// queries/list-ratings-for-ratee/list-ratings-for-ratee.request.dto.ts
interface ListRatingsForRateeRequestDto {
  rateeId: string;
  context: 'CLIENT_FACING' | 'INTERNAL';   // callers must be explicit — no default, to avoid accidentally leaking INTERNAL ratings into a public view
  limit: number;
  cursor?: string;
}
interface RatingResponseDto {
  score: number;
  comment: string | null;
  createdAt: string;
}
```

## Open items

- Resolved above: an `INTERNAL` rating submitted with a `comment` is now a **validation error**, not silently dropped — flagging the decision explicitly since it was previously left open.
- `AwardBadgeCommand` eligibility (still-active member vs. former member) — tracked in `docs/modules/party.md`, not this module.
