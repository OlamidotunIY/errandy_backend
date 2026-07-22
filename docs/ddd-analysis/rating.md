# Rating — DDD & EIP Analysis

## 1. Current Responsibility

Manages provider/client ratings and reviews:

- **Rating aggregation**: `getProviderRating`, `getClientRating` (computes average + count).
- **Batch queries**: `getProviderRatings` (fetches multiple provider ratings in one query).
- **Rating queries**: `getClientRatings`, `getErrandRatings` (fetches reviews with reactions + replies).
- **Reactions**: `toggleReaction` (user can react to a review with emoji).
- **Replies**: Not shown in excerpt, but likely in service (providers/clients can reply to reviews).

**Files**: `rating.service.ts` (~150+ lines), `rating.resolver.ts`, `rating.module.ts`.

## 2. Bounded Context Assessment

**This is a shared kernel** for "Reputation & Feedback".

- Rating is used by **Provider** (provider ratings), **Client** (client ratings), and **Errands** (errand-specific reviews).
- However, Rating is NOT part of those bounded contexts — it's a separate concern (like Notification or Search).

**Overlaps**:

- **Provider**: Provider module calls `RatingService.getProviderRatings` (line 30 of provider.service.ts) to enrich provider data.
- **Client**: Client ratings are queried for client profiles (reputation).
- **Errands**: Ratings are linked to errands (`errandId` in Rating model) — when errand completes, client rates provider and vice versa.

**Verdict**: Rating is a **separate bounded context** for reputation management. Should remain standalone (don't merge with Provider/Client/Errands).

## 3. Domain Model Audit

**Anemic models**:

- `Rating` (Prisma model) is a data bag with `rating` (number), `comment`, `rateeId`, `rateeType` (PROVIDER | CLIENT), `errandId`.
  - No behavior: No `Rating.edit()`, `Rating.delete()` methods.
- `RatingReaction` (Prisma model) is a data bag with `emoji`, `userId`, `ratingId`.
  - No behavior: No `RatingReaction.validate()` (validate emoji is allowed).
- `RatingReply` (Prisma model) is a data bag with `content`, `userId`, `ratingId`.
  - No behavior.

**Aggregate boundaries**:

- **`Rating`** should be the aggregate root, owning:
  - `RatingReaction` (child entity — reactions belong to rating).
  - `RatingReply` (child entity — replies belong to rating).
  - Invariants: Rating score is 1-5, ratee must exist, one rating per errand per user.
- **Rating creation**:
  - Should be in domain: `Rating.create(errandId, raterId, rateeId, score, comment)`.
  - Validate: User can only rate once per errand, rating score is 1-5.

**Invariants currently unenforced**:

1. **Rating score range**:
   - Service aggregates `_avg.rating`, but no validation that individual ratings are 1-5.
   - Should be a `Score` value object (validates range).
2. **One rating per user per errand**:
   - Not enforced (no unique constraint in Prisma model or service logic).
   - User could rate same provider multiple times for same errand.
3. **Ratee existence**:
   - `getProviderRating` queries by `rateeId`, but doesn't validate that provider exists.
   - If provider is deleted, orphaned ratings remain.
4. **Reaction emoji validation**:
   - `toggleReaction` (line 138) accepts any emoji string — no validation (allowed emojis: 👍, ❤️, etc.).

## 4. Layering Violations

**Business logic in service**:

- `toggleReaction` (line 138+) has toggle logic (delete if exists, update if different, create if new).
- This is domain behavior — should be `Rating.addReaction(userId, emoji)` method.

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.rating.*`, `this.prisma.ratingReaction.*`).
- No repository abstraction.
- Aggregation queries (`_avg`, `_count`, `groupBy`) are Prisma-specific — tightly coupled to MongoDB.

**Read model optimization**:

- `getProviderRatings` (line 59-92) is a batch query (prevents N+1 in provider discovery).
- This is fine as a query service, but mixing with write operations (toggleReaction) in same service violates CQRS.

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IRatingRepository (interface)
    - findById(id): Rating | null
    - findByErrand(errandId): Rating[]
    - findByRatee(rateeId, rateeType): Rating[]
    - save(rating): void
infrastructure/
  PrismaRatingRepository (implementation)

  queries/
    RatingStatsQueryService (read model)
      - getProviderStats(providerId): RatingStats
      - getProviderRatings(providerIds[]): Map<id, stats>  # Batch query
```

**Consolidation**: Write operations (create/update/delete rating) use repository. Read operations (rating aggregation) use query service.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **RatingCreated event**:
   - When user submits rating, emit event.
   - Listeners:
     - Provider/Client module updates cached average rating (denormalized field).
     - Notification sends "new review received" push notification to ratee.
     - Analytics tracks review submission rate.

2. **RatingUpdated event**:
   - When user edits rating (if allowed), emit event.
   - Listeners:
     - Provider/Client module recalculates average rating.
     - Notification sends "review updated" notification.

**Aggregator**:

- `getProviderRating` (line 15-31) aggregates ratings using Prisma `_avg` and `_count`.
- This is a **legitimate read model aggregator** — should be in CQRS query handler.

**Cache-Aside**:

- Current: Rating aggregation is computed on the fly (every query runs aggregation).
- Recommendation: Denormalize average rating in Provider/Client tables (update via event listener).
- Benefits: Faster queries (no aggregation), better scalability.

**Dead Letter / Retry**:

- No external calls in RatingService (all DB queries).
- If Prisma query fails (timeout), error bubbles up — no retry.

## 7. Cross-Cutting Concerns

**Validation**:

- No validation in RatingService:
  - Rating score range (1-5) not checked.
  - Ratee existence not verified.
  - Emoji validity not checked (line 138).

**Transactions**:

- `toggleReaction` (line 138+) has atomic upsert logic (check if exists → delete/update/create).
- No explicit transaction — if concurrent requests toggle same reaction, race condition possible.

**Error handling**:

- No custom exceptions (`InvalidRating`, `DuplicateRating`).
- Prisma errors bubble up to GraphQL (generic error messages).

## 8. GraphQL-Specific Notes

**GraphQL types**:

- `RatingStats` (line 7) is a read model DTO (average + count) — not a domain entity.
- `Rating` entity includes `reactions`, `replies` (line 101-108: Prisma includes) — nested data in single query.

**N+1 risk**:

- `getProviderRatings` (line 59-92) is a batch query (prevents N+1 when loading provider ratings).
- If client code queries `ratings { rater { avatar } }`, potential N+1 for rater profile — no DataLoader.

**Authorization**:

- No auth checks in RatingService:
  - Assumes resolver validates user can only rate after errand completion.
  - Assumes resolver validates user can only toggle their own reactions.

## 9. Target Structure

```
src/rating/
  domain/
    entities/
      Rating.ts                     # Aggregate root with addReaction(), addReply()
      RatingReaction.ts             # Child entity
      RatingReply.ts                # Child entity
    value-objects/
      Score.ts                      # Validates 1-5 range
      Emoji.ts                      # Validates allowed emojis
    repositories/
      IRatingRepository.ts          # Interface: findById, findByErrand, save
    events/
      RatingCreated.ts
      RatingUpdated.ts

  application/
    commands/
      CreateRating/
        CreateRatingCommand.ts
        CreateRatingHandler.ts      # Validate errand completed, create rating, emit event
      ToggleReaction/
        ToggleReactionCommand.ts
        ToggleReactionHandler.ts
    queries/
      GetRatingStats/
        GetRatingStatsQuery.ts
        GetRatingStatsHandler.ts    # Read model: aggregates average rating
      GetErrandRatings/
        GetErrandRatingsQuery.ts
        GetErrandRatingsHandler.ts
    event-handlers/
      OnRatingCreatedUpdateStats.ts # Listens to RatingCreated → updates denormalized average in Provider/Client

  infrastructure/
    repositories/
      PrismaRatingRepository.ts
    query-services/
      RatingStatsQueryService.ts    # Read model for aggregations (batch queries)

  presentation/
    resolvers/
      RatingResolver.ts
    types/
      RatingType.ts
      RatingStatsType.ts
```

## 10. Migration Risk & Priority

**Risk**: **LOW-MEDIUM**

- Rating is a read-heavy feature (queries for provider/client profiles).
- Refactoring won't break core flows (errands, payments).
- However, rating is tightly coupled to Provider module (discovery enrichment) — refactoring requires coordination.

**Priority**: **PHASE 2 (parallel with Provider)**
**Rationale**:

1. Rating is tightly coupled to Provider (discovery feeds show ratings) — refactor together.
2. Denormalizing ratings (cache average in Provider table) improves provider discovery performance.
3. Rating is simpler than Errands/Escrow — good candidate for CQRS pattern demonstration.

**Migration steps**:

1. **Extract Rating aggregate** with `addReaction()`, `addReply()` methods.
2. **Extract Score value object** (validates 1-5 range).
3. **Extract Emoji value object** (validates allowed emojis).
4. **Introduce IRatingRepository** and `PrismaRatingRepository`.
5. **Separate read model from write model** (CQRS):
   - Write: `CreateRatingHandler` uses `IRatingRepository`.
   - Read: `GetRatingStatsHandler` uses `RatingStatsQueryService`.
6. **Emit events**: `RatingCreated`, `RatingUpdated`.
7. **Denormalize average rating** in Provider/Client tables (update via event listener).
8. **Add DataLoader** for rating queries (prevent N+1 for rater profiles).
9. **Add rating moderation** (scan for spam/abuse before publishing).
