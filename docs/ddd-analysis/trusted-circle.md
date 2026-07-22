# Trusted-Circle — DDD & EIP Analysis

## 1. Current Responsibility

Manages client's list of trusted providers (favorites):

- **Get trusted circle**: `getTrustedCircle` (line 16-32) fetches active members with provider details.
- **Get pending members**: `getPendingMembers` (line 34-57) fetches members with `PENDING` status.
- **Add to circle**: `addToCircle` (line 59-108) adds a provider to client's circle (creates circle if doesn't exist).
- **Remove from circle**: `removeFromCircle` (line 110-126) deletes a member from circle.
- **Share circle**: `shareCircle` (line 128-152+) shares client's trusted circle with another user (via email or user ID).

**Files**: `trusted-circle.service.ts` (~150+ lines), `trusted-circle.resolver.ts`, `trusted-circle.module.ts`.

## 2. Bounded Context Assessment

**This is a sub-domain of Client** or a separate "Social Graph" bounded context.

- Trusted Circle is a **client-specific feature** — workers providers can't have trusted circles (only clients can).
- However, "Share Circle" (line 128+) introduces social/viral growth mechanics — could be a separate context.

**Overlaps**:

- **Client**: TrustedCircle belongs to Client (`trustedCircleId → Client.id`).
- **Provider**: TrustedCircle contains providers (`TrustedCircleMember.providerId → Provider.id`).
- **Errands**: Provider discovery (in Provider module, line 66+ of provider.service.ts) queries trusted circle to prioritize trusted providers.

**Verdict**: Trusted Circle is a **sub-domain of Client** (merge into Client module) unless social features grow complex (sharing, recommendations, social proof).

## 3. Domain Model Audit

**Anemic models**:

- `TrustedCircle` (Prisma model) is a data bag with `clientId`, `name`, `members`.
  - No behavior: No `TrustedCircle.addMember()`, `TrustedCircle.removeMember()` methods.
- `TrustedCircleMember` (Prisma model) is a data bag with `providerId`, `status`, `source`.
  - No behavior.

**Aggregate boundaries**:

- **`TrustedCircle`** should be the aggregate root, owning:
  - `TrustedCircleMember` (child entity — members belong to circle).
  - Invariants: Circle must belong to a client, members must be valid providers, no duplicate members.

**Invariants currently unenforced**:

1. **Duplicate prevention**:
   - `addToCircle` (line 88-97) checks for existing member and returns early (line 97) — good.
   - However, no validation that provider exists before adding (line 81-85: checks, but after circle creation).
2. **Circle name**:
   - Default circle name is "My Trusted Circle" (line 73) — hardcoded in service, should be in domain.
3. **Member status**:
   - `status` field (PENDING | ACTIVE) is stored, but no logic for approving/rejecting pending members.
   - If provider must approve being added to circle (privacy), status transitions should be in domain.

## 4. Layering Violations

**Business logic in service**:

- `addToCircle` (line 59-108) orchestrates:
  1. Find or create circle (upsert logic).
  2. Check provider existence.
  3. Check for duplicates.
  4. Create member.

  This is a **use case** (command handler), not a domain service. Should be `AddToCircleCommandHandler`.

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.trustedCircle.*`, `this.prisma.trustedCircleMember.*`).
- No repository abstraction.

**Event emission missing**:

- When provider is added to circle, should emit `ProviderAddedToCircle` event:
  - Listeners:
    - Notification sends "you've been added to X's trusted circle" push notification to provider (if member status is ACTIVE).
    - Analytics tracks viral growth (how many circles each provider is in).

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  ITrustedCircleRepository (interface)
    - findByClientId(clientId): TrustedCircle | null
    - save(circle): void
infrastructure/
  PrismaTrustedCircleRepository (implementation)
```

**Consolidation**: All `prisma.trustedCircle.*` calls move to repository.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **ProviderAddedToCircle event**:
   - When client adds provider to circle, emit event.
   - Listeners:
     - Provider module increments "times added to circles" metric (social proof).
     - Notification sends "you've been added to a trusted circle" push notification to provider.

2. **CircleShared event**:
   - When client shares circle (line 128+), emit event.
   - Listeners:
     - Notification sends "X shared their trusted circle with you" email to recipient.
     - Analytics tracks viral growth.

**Dead Letter / Retry**:

- No external calls in TrustedCircleService (all DB queries).

## 7. Cross-Cutting Concerns

**Validation**:

- `shareCircle` (line 128+) validates recipient (email or user ID required) — good (line 131-133).

**Transactions**:

- `addToCircle` (line 59-108) creates circle, then creates member — two Prisma calls, no transaction.
- Race condition: If two providers are added concurrently to new circle, circle could be created twice (duplicate circles).

**Error handling**:

- Throws `NotFoundException` (line 62, line 84, line 115, line 120, line 138, line 145) — good domain errors.
- Throws `BadRequestException` (line 131) — HTTP-specific exception in service layer.

## 8. GraphQL-Specific Notes

**Authorization**:

- No auth checks in service (assumes resolver validates user can only manage their own circle).

## 9. Target Structure

```
src/client/
  domain/
    entities/
      TrustedCircle.ts              # Aggregate root with addMember(), removeMember()
      TrustedCircleMember.ts        # Child entity
    value-objects/
      MemberStatus.ts               # PENDING | ACTIVE
      MemberSource.ts               # MANUAL_ADD | AUTO_SUGGESTED | SHARED
    repositories/
      ITrustedCircleRepository.ts
    events/
      ProviderAddedToCircle.ts
      ProviderRemovedFromCircle.ts
      CircleShared.ts

  application/
    commands/
      AddToCircle/
        AddToCircleCommand.ts
        AddToCircleHandler.ts
      RemoveFromCircle/
        RemoveFromCircleCommand.ts
        RemoveFromCircleHandler.ts
      ShareCircle/
        ShareCircleCommand.ts
        ShareCircleHandler.ts
    queries/
      GetTrustedCircle/
        GetTrustedCircleQuery.ts
        GetTrustedCircleHandler.ts

  infrastructure/
    repositories/
      PrismaTrustedCircleRepository.ts
```

**Recommendation**: Merge Trusted-Circle into Client module (as part of client domain).

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Trusted Circle is a supporting feature — refactoring won't break core flows (errands, payments).
- Provider discovery (in Provider module) queries trusted circle, but that's a read operation (low coupling).

**Priority**: **PHASE 2 (parallel with Client/Provider)**
**Rationale**:

1. Trusted Circle is tightly coupled to Client — refactor together.
2. Trusted Circle is used by Provider discovery — refactor together for consistency.
3. Current implementation is functional — no critical bugs.

**Migration steps**:

1. **Merge Trusted-Circle into Client module** (or keep separate if social features grow).
2. **Extract TrustedCircle aggregate** with `addMember()`, `removeMember()` methods.
3. **Introduce ITrustedCircleRepository** and `PrismaTrustedCircleRepository`.
4. **Create command handlers** (AddToCircle, RemoveFromCircle, ShareCircle).
5. **Emit events**: `ProviderAddedToCircle`, `CircleShared`.
6. **Add transaction** for circle creation + member creation (prevent duplicate circles).
7. **Implement member approval flow** (if provider must approve being added to circle).
