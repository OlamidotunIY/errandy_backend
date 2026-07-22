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

---

## 10. Schema Findings

**Context**: Analysis of `prisma/model/rating.prisma`.

### Aggregate Boundary Violations

**None found for Rating aggregate** — no other modules directly mutate Rating fields. Rating aggregate integrity is intact at schema level.

**Note**: RatingService creates ratings, but this is appropriate (Rating is the entry point for rating creation).

### Dangling Reference Risks

1. **Rating.errandId → Errand** (MEDIUM)
   - **Schema**: No cascade rule.
   - **Bug**: Deleting errand orphans all ratings for that errand.
   - **Impact**: MEDIUM — cannot link rating to originating job context, but rating itself remains useful (attached to provider/client profile).
   - **Current cleanup**: None (errand deletion not implemented yet).
   - **Fix**: Add `onDelete: SetNull` (preserve rating for provider/client profile, but clear errand link).
   - **Justification**: Ratings are valuable historical data for provider/client reputation even after errand deleted.
   - **Schema change**:
     ```prisma
     model Rating {
       errand Errand? @relation(fields: [errandId], references: [id], onDelete: SetNull)
     }
     ```
   - **Migration**: `npx prisma db push` (additive).
   - **Rollback**: Safe (remove cascade rule).
   - **Priority**: PHASE 2 (before errand deletion feature).

2. **Rating.rateeId → Provider OR Client** (polymorphic reference)
   - **Schema**: `rateeId` with `rateeType` enum (polymorphic), no formal relation, so no cascade possible.
   - **Bug**: Deleting provider/client leaves dangling `rateeId`.
   - **Impact**: MEDIUM — cannot resolve rated entity in GraphQL queries.
   - **Current cleanup**: None.
   - **Fix**: Add event handlers:
     - `ProviderDeleted` → nullify all `Rating.rateeId` where `rateeType = PROVIDER` and `rateeId = deletedId`.
     - `ClientDeleted` → nullify all `Rating.rateeId` where `rateeType = CLIENT` and `rateeId = deletedId`.
   - **Alternative**: Soft-delete provider/client instead (set `isDeleted = true`), preserve ratings.
   - **Recommendation**: Soft-delete approach (preserve rating data for platform statistics).
   - **Priority**: PHASE 2 (defer until provider/client deletion implemented).

3. **Rating.raterId → Provider OR Client** (polymorphic reference)
   - **Schema**: Similar to rateeId (polymorphic, no formal relation).
   - **Bug**: Deleting rater leaves dangling `raterId`.
   - **Impact**: LOW — can still display rating, just cannot link back to rater profile.
   - **Fix**: Same event handlers as rateeId (nullify on deletion).
   - **Recommendation**: Soft-delete approach.
   - **Priority**: PHASE 2.

4. **RatingReply.userId → User**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting user orphans all rating replies from that user.
   - **Impact**: LOW — reply text remains, just cannot link to user profile.
   - **Fix**: Add `onDelete: SetNull` OR cascade delete replies.
   - **Recommendation**: `onDelete: SetNull` (preserve reply content).
   - **Priority**: PHASE 2.

5. **RatingReaction.userId → User**
   - **Schema**: No cascade rule.
   - **Bug**: Deleting user orphans all rating reactions from that user.
   - **Impact**: LOW — reaction emoji remains, just cannot link to user.
   - **Fix**: Add `onDelete: Cascade` (remove reaction on user deletion).
   - **Recommendation**: Cascade (reactions have no value without user context).
   - **Priority**: PHASE 2.

### Missing Indexes

**Critical indexes MISSING** (HIGH priority):

1. **Rating.errandId** (HIGH for query performance)
   - **Query pattern**: `RatingService.getErrandRatings` (line ~80) queries `where: { errandId }`.
   - **Impact**: Full collection scan when fetching ratings for an errand (common query).
   - **Fix**: Add `@@index([errandId])`.
   - **Priority**: **PHASE 2** (HIGH).

2. **Rating.rateeId + rateeType** (CRITICAL for provider/client profile queries)
   - **Query pattern**: Provider/Client profile showing "Ratings I received" — queries `where: { rateeId, rateeType }`.
   - **Impact**: Full collection scan when fetching ratings for a provider/client (CRITICAL for profile page performance).
   - **Fix**: Add compound index `@@index([rateeId, rateeType])`.
   - **Priority**: **PHASE 2** (CRITICAL).

3. **Rating.raterId + raterType** (MEDIUM for "Ratings I gave" queries)
   - **Query pattern**: User profile showing "Ratings I gave" — queries `where: { raterId, raterType }`.
   - **Impact**: Full collection scan.
   - **Fix**: Add compound index `@@index([raterId, raterType])`.
   - **Priority**: PHASE 2.

4. **Rating.createdAt** (LOW for sorting)
   - **Query pattern**: Sorting ratings by date (`orderBy: { createdAt: 'desc' }`).
   - **Impact**: Inefficient sorting on large datasets.
   - **Fix**: Add `@@index([createdAt])`.
   - **Priority**: PHASE 3 (optimization).

**Schema changes needed**:

```prisma
model Rating {
  // ... existing fields ...

  @@index([errandId])
  @@index([rateeId, rateeType])
  @@index([raterId, raterType])
  @@index([createdAt])
  @@map("ratings")
}
```

**Migration**: `npx prisma db push` (additive, no backfill).
**Rollback**: Safe (drop indexes).

### Embed vs. Reference Decisions

**Denormalization proposal: Add averageRating and ratingCount to Provider/Client models**:

1. **Current**: Every provider/client profile query must aggregate ratings in real-time.
   - **Query**: `db.ratings.aggregate([{ $match: { rateeId, rateeType } }, { $group: { _id: null, avg: { $avg: '$score' } } }])`
   - **Impact**: Slow profile page load (N+1 if loading multiple providers).

2. **Proposal**: Add denormalized fields to Provider and Client models:

   ```prisma
   model Provider {
     averageRating Float?
     ratingCount   Int @default(0)
   }

   model Client {
     averageRating Float?
     ratingCount   Int @default(0)
   }
   ```

3. **Implementation**:
   - Event handler: `OnRatingCreatedUpdateStats` listens to `RatingCreated` event.
   - Recalculate average: `(currentAvg * currentCount + newScore) / (currentCount + 1)`.
   - Increment count: `currentCount + 1`.
   - Update Provider/Client record.

4. **Migration**:
   - Add columns: `npx prisma db push`.
   - Backfill script:
     ```typescript
     // scripts/backfill-rating-stats.ts
     async function backfillRatingStats() {
       const providers = await prisma.provider.findMany();
       for (const provider of providers) {
         const ratings = await prisma.rating.findMany({
           where: { rateeId: provider.id, rateeType: 'PROVIDER' },
         });
         const avg =
           ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
         await prisma.provider.update({
           where: { id: provider.id },
           data: { averageRating: avg || null, ratingCount: ratings.length },
         });
       }
       // Repeat for clients...
     }
     ```
   - Rollback: Drop columns (safe).
   - Risk: MEDIUM (need event listener with retry/dead-letter queue for partial failure recovery).

5. **Priority**: PHASE 2 (performance optimization for provider/client discovery).

### Migration / Rollback Strategy

**Phase 2 changes for Rating**:

1. **Add cascade rules** (5 dangling-reference fixes):
   - `Rating.errandId` → `onDelete: SetNull`
   - `RatingReply.userId` → `onDelete: SetNull`
   - `RatingReaction.userId` → `onDelete: Cascade`
   - Migration: `npx prisma db push`.
   - Rollback: Safe (remove cascade rules).
   - Risk: LOW.

2. **Add indexes** (4 missing indexes):
   - Migration: `npx prisma db push`.
   - Rollback: Safe (drop indexes).
   - Risk: LOW.

3. **Add event handlers for polymorphic deletions** (Rating.rateeId, Rating.raterId):
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: LOW.

4. **Add denormalized rating stats** (Provider/Client.averageRating, ratingCount):
   - Schema change: Add columns.
   - Backfill: Run `scripts/backfill-rating-stats.ts`.
   - Event listener: Deploy `OnRatingCreatedUpdateStats` handler.
   - Migration: Schema + backfill + code.
   - Rollback: Code revert + drop columns (backfill cannot be rolled back, but safe).
   - Risk: MEDIUM (event listener must handle partial failures).

5. **Extract Rating aggregate** (code-only):
   - Create `Rating.addReaction()`, `Rating.addReply()` methods.
   - Emit events: `RatingCreated`, `RatingUpdated`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: LOW (Rating is isolated module, minimal cross-module dependencies).

**Risk revised from LOW-MEDIUM to LOW-MEDIUM**: Schema changes are low-risk (additive). Main risk is denormalization event listener (MEDIUM) due to partial failure handling.

**Mitigation**: Add indexes first (Phase 2 start), implement denormalization later (Phase 2 end) after event infrastructure proven stable.

---

## 11. Migration Risk & Priority

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

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Rating aggregate root representing a rating given after errand completion.
 * Core invariants:
 * - Score must be 1-5 stars
 * - Rating can only be created for COMPLETED errands
 * - Each user can rate each errand only once (raterId + errandId is unique)
 * - Reactions can only use allowed emoji set
 * - Replies can only be added by the rating target (rateeId)
 * - Ratings are immutable after creation (except reactions/replies)
 */
class RatingId extends EntityId {
  /**
   * Private constructor. Use RatingId.new() or RatingId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new RatingId.
   */
  static new(): RatingId;

  /**
   * Rehydrates RatingId from persisted value.
   */
  static from(value: string): RatingId;
}

/**
 * Rating aggregate root representing a rating given after errand completion.
 */
class Rating extends AggregateRoot<RatingId> {
  /**
   * Private constructor - use Rating.create() factory or load from repository.
   * @param id Unique rating identifier (from schema: id String @id)
   * @param raterId User who gave rating (from schema: raterId String)
   * @param rateeId User being rated (from schema: rateeId String)
   * @param errandId Errand this rating is for (from schema: errandId String @unique)
   * @param raterRole Role of rater (from schema: raterRole RaterRole)
   * @param score Rating score 1-5 (from schema: score Int)
   * @param comment Optional text review (from schema: comment String?)
   * @param reactions Emoji reactions to rating (from schema: RatingReaction[])
   * @param reply Optional reply from ratee (from schema: reply String?)
   * @param createdAt Creation timestamp
   * @param updatedAt Last update timestamp
   */
  private constructor(
    public readonly id: RatingId,
    public readonly raterId: UserId,
    public readonly rateeId: UserId,
    public readonly errandId: ErrandId,
    public readonly raterRole: RaterRole,
    private score: Score,
    private comment: string | null,
    private readonly reactions: RatingReaction[],
    private reply: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Factory method to create new rating.
   * Rating can only be created for completed errands.
   * @param raterId User giving rating
   * @param rateeId User being rated
   * @param errandId Completed errand ID
   * @param raterRole Role of rater (CLIENT or PROVIDER)
   * @param score Rating score 1-5
   * @param comment Optional text review
   * @throws InvalidScoreError when score < 1 or > 5
   * @throws DuplicateRatingError when user already rated this errand (DB constraint violation)
   * @returns New Rating instance
   */
  static create(
    raterId: UserId,
    rateeId: UserId,
    errandId: ErrandId,
    raterRole: RaterRole,
    score: number,
    comment?: string,
  ): Rating;

  /**
   * Reconstitutes Rating aggregate from persistence.
   */
  static reconstitute(
    id: RatingId,
    raterId: UserId,
    rateeId: UserId,
    errandId: ErrandId,
    raterRole: RaterRole,
    score: Score,
    comment: string | null,
    reactions: RatingReaction[],
    reply: string | null,
    createdAt: Date,
    updatedAt: Date,
  ): Rating;

  /**
   * Adds emoji reaction to rating.
   * Users can react to ratings (like, love, etc.).
   * @param userId User adding reaction
   * @param emoji Emoji type
   * @throws InvalidEmojiError when emoji not in allowed set
   * @throws DuplicateReactionError when user already reacted with this emoji
   * @emits RatingReactionAddedEvent
   */
  addReaction(userId: UserId, emoji: string): void;

  /**
   * Removes emoji reaction.
   * @param userId User removing reaction
   * @param emoji Emoji type
   * @throws ReactionNotFoundError when reaction doesn't exist
   * @emits RatingReactionRemovedEvent
   */
  removeReaction(userId: UserId, emoji: string): void;

  /**
   * Adds reply to rating (only ratee can reply).
   * @param reply Reply text
   * @throws ReplyAlreadyExistsError when rating already has reply
   * @emits RatingRepliedEvent
   */
  addReply(reply: string): void;

  /**
   * Updates reply text.
   * @param newReply Updated reply text
   * @throws NoReplyExistsError when rating has no reply
   * @emits RatingReplyUpdatedEvent
   */
  updateReply(newReply: string): void;

  /**
   * Returns score value (1-5).
   */
  getScore(): number;

  /**
   * Returns comment text or null.
   */
  getComment(): string | null;
}

/**
 * RatingReaction child entity (owned by Rating aggregate).
 * Immutable once created.
 */
class RatingReaction {
  constructor(
    public readonly id: string,
    public readonly ratingId: RatingId,
    public readonly userId: UserId,
    public readonly emoji: Emoji,
    public readonly createdAt: Date,
  );
}

/**
 * Score value object (validates 1-5 range).
 * Immutable.
 */
class Score {
  /**
   * @param value Score 1-5
   * @throws InvalidScoreError when value < 1 or > 5
   */
  constructor(public readonly value: number);

  /**
   * Returns score as integer.
   */
  toNumber(): number;
}

/**
 * Emoji value object (validates allowed emoji set).
 * Immutable.
 */
class Emoji {
  private static readonly ALLOWED_EMOJIS = [
    '👍', '❤️', '😊', '😮', '😢', '😡'
  ];

  /**
   * @param value Emoji string
   * @throws InvalidEmojiError when emoji not in allowed set
   */
  constructor(public readonly value: string);

  /**
   * Returns emoji string.
   */
  toString(): string;
}

/** Thrown when score outside 1-5 range. */
class InvalidScoreError extends Error {}

/** Thrown when user tries to rate same errand twice. */
class DuplicateRatingError extends Error {}

/** Thrown when emoji not in allowed set. */
class InvalidEmojiError extends Error {}

/** Thrown when user tries to react twice with same emoji. */
class DuplicateReactionError extends Error {}

/** Thrown when reaction doesn't exist. */
class ReactionNotFoundError extends Error {}

/** Thrown when rating already has reply. */
class ReplyAlreadyExistsError extends Error {}

/** Thrown when trying to update non-existent reply. */
class NoReplyExistsError extends Error {}
```

### Repository Interface

```typescript
/**
 * Persistence contract for Rating aggregate.
 */
interface IRatingRepository {
  /**
   * Finds rating by unique ID.
   * @param id Rating ID
   * @returns Rating aggregate or null if not found
   */
  findById(id: RatingId): Promise<Rating | null>;

  /**
   * Finds rating for specific errand.
   * Each errand has exactly one rating per user.
   * @param errandId Errand ID
   * @param raterId Rater user ID
   * @returns Rating aggregate or null if not found
   */
  findByErrandAndRater(
    errandId: ErrandId,
    raterId: UserId,
  ): Promise<Rating | null>;

  /**
   * Finds all ratings given by user.
   * @param raterId Rater user ID
   * @returns Array of Rating aggregates
   */
  findByRater(raterId: UserId): Promise<Rating[]>;

  /**
   * Finds all ratings received by user.
   * @param rateeId Ratee user ID
   * @returns Array of Rating aggregates
   */
  findByRatee(rateeId: UserId): Promise<Rating[]>;

  /**
   * Persists rating aggregate.
   * @param rating Rating to save
   */
  save(rating: Rating): Promise<void>;

  /**
   * Calculates average rating score for user.
   * Used to denormalize Provider.averageRating and Client.averageRating.
   * @param rateeId User being rated
   * @returns Average score (1.0-5.0) or null if no ratings
   */
  calculateAverageRating(rateeId: UserId): Promise<number | null>;

  /**
   * Gets rating statistics for user.
   * @param rateeId User being rated
   * @returns Stats object with counts per star level
   */
  getRatingStats(rateeId: UserId): Promise<RatingStats>;
}

interface RatingStats {
  totalRatings: number;
  averageScore: number | null;
  oneStar: number;
  twoStar: number;
  threeStar: number;
  fourStar: number;
  fiveStar: number;
}
```

### Application Layer

```typescript
/**
 * Creates new rating for completed errand.
 */
class CreateRatingCommandHandler {
  /**
   * @param command Rating details
   * @throws ErrandNotFoundException when errand doesn't exist
   * @throws ErrandNotCompletedException when errand status is not COMPLETED
   * @throws DuplicateRatingError when user already rated this errand
   * @throws InvalidScoreError when score < 1 or > 5
   * @throws UnauthorizedException when raterId is not errand participant
   * @emits RatingCreatedEvent
   * @returns Rating ID
   */
  execute(command: CreateRatingCommand): Promise<RatingId>;
}

interface CreateRatingCommand {
  raterId: UserId;
  rateeId: UserId;
  errandId: ErrandId;
  raterRole: RaterRole; // CLIENT or PROVIDER
  score: number; // 1-5
  comment?: string;
}

/**
 * Adds emoji reaction to rating.
 */
class AddRatingReactionCommandHandler {
  /**
   * @param command Reaction details
   * @throws RatingNotFoundException when rating doesn't exist
   * @throws InvalidEmojiError when emoji not allowed
   * @throws DuplicateReactionError when user already reacted with this emoji
   * @emits RatingReactionAddedEvent
   */
  execute(command: AddRatingReactionCommand): Promise<void>;
}

interface AddRatingReactionCommand {
  ratingId: RatingId;
  userId: UserId;
  emoji: string;
}

/**
 * Removes emoji reaction.
 */
class RemoveRatingReactionCommandHandler {
  /**
   * @param command Reaction to remove
   * @throws RatingNotFoundException when rating doesn't exist
   * @throws ReactionNotFoundError when reaction doesn't exist
   * @emits RatingReactionRemovedEvent
   */
  execute(command: RemoveRatingReactionCommand): Promise<void>;
}

interface RemoveRatingReactionCommand {
  ratingId: RatingId;
  userId: UserId;
  emoji: string;
}

/**
 * Adds reply to rating (ratee responds to rating).
 */
class AddRatingReplyCommandHandler {
  /**
   * @param command Reply details
   * @throws RatingNotFoundException when rating doesn't exist
   * @throws UnauthorizedException when repliedBy is not rateeId
   * @throws ReplyAlreadyExistsError when rating already has reply
   * @emits RatingRepliedEvent
   */
  execute(command: AddRatingReplyCommand): Promise<void>;
}

interface AddRatingReplyCommand {
  ratingId: RatingId;
  repliedBy: UserId; // must match rateeId
  reply: string;
}

/**
 * Updates existing reply.
 */
class UpdateRatingReplyCommandHandler {
  /**
   * @param command Updated reply
   * @throws RatingNotFoundException when rating doesn't exist
   * @throws UnauthorizedException when updatedBy is not rateeId
   * @throws NoReplyExistsError when rating has no reply
   * @emits RatingReplyUpdatedEvent
   */
  execute(command: UpdateRatingReplyCommand): Promise<void>;
}

interface UpdateRatingReplyCommand {
  ratingId: RatingId;
  updatedBy: UserId; // must match rateeId
  reply: string;
}

/**
 * Query handler: Get rating by ID.
 */
class GetRatingQueryHandler {
  /**
   * @param query Rating ID
   * @returns Rating details with rater/ratee profiles
   * @throws RatingNotFoundException when not found
   */
  execute(query: GetRatingQuery): Promise<RatingDTO>;
}

interface GetRatingQuery {
  ratingId: RatingId;
}

/**
 * Query handler: Get ratings received by user.
 */
class GetUserRatingsQueryHandler {
  /**
   * @param query User ID
   * @returns Array of ratings with rater profiles
   */
  execute(query: GetUserRatingsQuery): Promise<RatingDTO[]>;
}

interface GetUserRatingsQuery {
  rateeId: UserId;
}

/**
 * Query handler: Get rating statistics for user.
 */
class GetRatingStatsQueryHandler {
  /**
   * @param query User ID
   * @returns Rating stats with breakdown per star level
   */
  execute(query: GetRatingStatsQuery): Promise<RatingStatsDTO>;
}

interface GetRatingStatsQuery {
  rateeId: UserId;
}

interface RatingDTO {
  id: RatingId;
  raterId: UserId;
  rateeId: UserId;
  errandId: ErrandId;
  raterRole: RaterRole;
  score: number;
  comment: string | null;
  reactions: { emoji: string; userId: UserId; createdAt: Date }[];
  reply: string | null;
  createdAt: Date;
  updatedAt: Date;
  rater?: { id: UserId; name: string; image: string | null };
  ratee?: { id: UserId; name: string; image: string | null };
}

interface RatingStatsDTO {
  totalRatings: number;
  averageScore: number | null;
  distribution: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  };
}
```

### Domain Events

```typescript
/**
 * Emitted when new rating created.
 * CRITICAL: Triggers denormalization of Provider.averageRating or Client.averageRating.
 * Consumed by: Provider module, Client module, Notification module
 */
class RatingCreatedEvent {
  constructor(
    public readonly ratingId: RatingId,
    public readonly raterId: UserId,
    public readonly rateeId: UserId,
    public readonly errandId: ErrandId,
    public readonly raterRole: RaterRole,
    public readonly score: number,
  ) {}
}

/**
 * Emitted when reaction added to rating.
 * Consumed by: Notification (notify rating author of reaction)
 */
class RatingReactionAddedEvent {
  constructor(
    public readonly ratingId: RatingId,
    public readonly userId: UserId,
    public readonly emoji: string,
  ) {}
}

/**
 * Emitted when reaction removed.
 */
class RatingReactionRemovedEvent {
  constructor(
    public readonly ratingId: RatingId,
    public readonly userId: UserId,
    public readonly emoji: string,
  ) {}
}

/**
 * Emitted when ratee replies to rating.
 * Consumed by: Notification (notify rater of reply)
 */
class RatingRepliedEvent {
  constructor(
    public readonly ratingId: RatingId,
    public readonly rateeId: UserId,
    public readonly reply: string,
  ) {}
}

/**
 * Emitted when reply updated.
 */
class RatingReplyUpdatedEvent {
  constructor(
    public readonly ratingId: RatingId,
    public readonly reply: string,
  ) {}
}
```

### Event Handlers (React to other module events)

```typescript
/**
 * Listens to ErrandCompletedEvent and prompts client/worker to rate each other.
 * Sends notification reminder.
 */
class OnErrandCompletedPromptRatingHandler {
  /**
   * @listens ErrandCompletedEvent
   * Sends notifications to client and worker to rate each other
   */
  handle(event: ErrandCompletedEvent): Promise<void>;
}

/**
 * Listens to RatingCreatedEvent and updates Provider.averageRating.
 * Denormalization for performance.
 */
class OnRatingCreatedUpdateProviderRatingHandler {
  /**
   * @listens RatingCreatedEvent
   * Recalculates Provider.averageRating and updates Provider table
   */
  handle(event: RatingCreatedEvent): Promise<void>;
}

/**
 * Listens to RatingCreatedEvent and updates Client.averageRating.
 * Denormalization for performance.
 */
class OnRatingCreatedUpdateClientRatingHandler {
  /**
   * @listens RatingCreatedEvent
   * Recalculates Client.averageRating and updates Client table
   */
  handle(event: RatingCreatedEvent): Promise<void>;
}
```
