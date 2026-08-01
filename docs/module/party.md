# Module: party

Merges the former `client`, `provider`, `organizations` modules, built on the Party pattern (Fowler, *Analysis Patterns*) — a shared identity (`Party`) for anything that can post/apply-to errands, with structure (`Person`/`Organization`) and time-varying role data (`ProviderRole`) split into separate tables rather than one wide, nullable-heavy record.

**Capability model, simplified by this pattern**: there's no `capabilities` array anymore. "Does this party have provider capability" is just "does a `ProviderRole` row exist for it" — adding/removing the capability is inserting/deleting that row, not mutating flags on a shared record. There's no `ClientRole` table yet, since no client-specific data exists beyond posting errands — any `Party` can post an errand by default (add `ClientRole` later if that changes — YAGNI).

## Folder placement

```
src/modules/party/
├── domain/
│   ├── entities/
│   │   ├── party.entity.ts
│   │   ├── person.entity.ts
│   │   ├── organization.entity.ts
│   │   ├── provider-role.entity.ts
│   │   └── provider-badge.entity.ts
│   ├── value-objects/
│   │   ├── party-kind.vo.ts          (PERSON | ORGANIZATION)
│   │   └── provider-tier.vo.ts       (COMMUNITY | VERIFIED | CERTIFIED)
│   ├── repositories/
│   │   └── party.repository.interface.ts
│   └── errors/
│       ├── party-not-found.error.ts
│       ├── provider-role-already-exists.error.ts
│       ├── organization-member-already-exists.error.ts
│       └── organization-member-not-found.error.ts
├── application/
│   ├── commands/
│   │   ├── create-person-party/
│   │   ├── create-organization-party/
│   │   ├── add-provider-role/
│   │   ├── request-tier-upgrade/
│   │   ├── update-provider-role/
│   │   ├── deactivate-party/
│   │   ├── add-organization-member/
│   │   ├── remove-organization-member/
│   │   └── award-badge/
│   ├── event-handlers/
│   │   ├── on-auth-user-registered.handler.ts   (ACL consumer — creates the initial Party)
│   │   ├── on-verification-completed.handler.ts
│   │   ├── on-trusted-circle-member-confirmed.handler.ts   (and -removed)
│   │   ├── on-errand-completed.handler.ts        (completedErrandsCount)
│   │   ├── on-dispute-opened.handler.ts          (disputedErrandsCount)
│   │   └── on-rating-submitted.handler.ts        (CLIENT_FACING only — avgRatingCached recompute)
│   ├── sagas/
│   │   └── trusted-by-count-sync.saga.ts   (consumer side; trigger lives in trusted-circle)
│   ├── jobs/
│   │   ├── provider-response-time-recalc.job.ts
│   │   ├── profile-rating-recalc.job.ts
│   │   └── monthly-trust-stats.job.ts
│   └── queries/
│       ├── get-party-by-id/
│       ├── get-public-provider-profile/
│       ├── get-org-facing-provider-profile/
│       └── search-providers-by-service/
├── infrastructure/
│   ├── mappers/
│   │   └── party.mapper.ts
│   └── repositories/
│       └── party.repository.ts
└── party.module.ts
```

## Prisma schema

`Person`, `Organization`, and `ProviderRole` share their primary key with `Party` (Prisma's standard workaround for 1:1 table-per-type, since Prisma/Mongo has no native inheritance). These `@relation`s are **within** the `Party` aggregate — fine, per the aggregate-boundary convention in `patterns-index.md`. Every reference from *outside* this module must be a plain scalar field, never a relation into these tables.

```prisma
enum PartyKind {
  PERSON
  ORGANIZATION
}

enum ProviderTier {
  COMMUNITY
  VERIFIED
  CERTIFIED
}

model Party {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  kind      PartyKind
  marketId  String    @db.ObjectId
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  person       Person?
  organization Organization?
  providerRole ProviderRole?
}

model Person {
  id     String @id @map("_id") @db.ObjectId   // shared PK with Party
  party  Party  @relation(fields: [id], references: [id])
  userId String @unique @db.ObjectId            // better-auth user id
}

model Organization {
  id                         String   @id @map("_id") @db.ObjectId
  party                      Party    @relation(fields: [id], references: [id])
  name                       String
  businessRegistrationNumber String
  ownerId                    String   @db.ObjectId   // better-auth user id
  workerPoolPercentage       Int      @default(70)
  createdAt                  DateTime @default(now())

  members OrganizationMember[]
}

model OrganizationMember {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  organizationId String   @db.ObjectId
  organization   Organization @relation(fields: [organizationId], references: [id])
  userId         String   @db.ObjectId
  role           String   // OWNER | ADMIN | MEMBER
  active         Boolean  @default(true)

  @@unique([organizationId, userId])
}

model ProviderRole {
  id                     String       @id @map("_id") @db.ObjectId   // shared PK with Party
  party                  Party        @relation(fields: [id], references: [id])
  tier                   ProviderTier @default(COMMUNITY)
  bio                    String?
  skills                 String[]
  verificationStatus     Boolean      @default(false)
  trustedByCount         Int          @default(0)
  completedErrandsCount  Int          @default(0)
  disputedErrandsCount   Int          @default(0)
  avgResponseTimeSeconds Int?
  avgRatingCached        Float?
  isActive               Boolean      @default(true)
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt
}

model ProviderBadge {
  id                     String   @id @default(auto()) @map("_id") @db.ObjectId
  partyId                String   @db.ObjectId   // plain scalar, no @relation — this is a query-side convenience record, not part of the ProviderRole aggregate write path
  badgeType              String   // WORKER_OF_THE_MONTH | WORKER_OF_THE_YEAR
  awardedByOrganizationId String  @db.ObjectId
  period                 String   // e.g. "2026-07"
  awardedAt              DateTime @default(now())
}
```

## Domain entity methods

**`Party`** (aggregate root)
- `createPerson(userId, marketId)` — static factory
- `createOrganization(ownerId, name, businessRegistrationNumber, marketId)` — static factory
- `addProviderRole()` — throws `ProviderRoleAlreadyExistsError` if one exists
- `deactivate()`

**`ProviderRole`**
- `recordVerificationCompleted(tier)` — sets `verificationStatus`, updates `tier`
- `updateProfile(bio?, skills?)`
- `incrementTrustedByCount()` / `decrementTrustedByCount()`
- `incrementCompletedErrandsCount()`
- `incrementDisputedErrandsCount()`
- `recomputeAvgRating(newWeightedAverage)`

**`Organization`**
- `addMember(userId, role)` — throws `OrganizationMemberAlreadyExistsError`
- `removeMember(userId)` — throws `OrganizationMemberNotFoundError`
- `updateWorkerPoolPercentage(percentage)`

## Repository interface

```typescript
abstract class IPartyRepository {
  abstract save(party: Party): Promise<void>;             // persists Party + whichever of Person/Organization/ProviderRole are attached, as one unit
  abstract findById(id: string): Promise<Party | null>;
  abstract findByUserId(userId: string): Promise<Party | null>;   // Person lookup
  abstract findByOwnerId(userId: string): Promise<Party[]>;       // Organizations a user owns
  abstract findOrganizationMembers(organizationPartyId: string): Promise<OrganizationMember[]>;
}
```

## DTOs

Placement: `application/commands/<name>/<name>.request.dto.ts` / `.response.dto.ts`, `application/queries/<name>/` likewise.

```typescript
// commands/create-person-party/create-person-party.request.dto.ts
interface CreatePersonPartyRequestDto {
  userId: string;
  phoneNumber: string;   // used to resolve marketId, not stored directly on Party
}
interface CreatePersonPartyResponseDto {
  partyId: string;
}

// commands/add-provider-role/add-provider-role.request.dto.ts
interface AddProviderRoleRequestDto {
  partyId: string;
}
interface AddProviderRoleResponseDto {
  partyId: string;
  tier: 'COMMUNITY';
}

// commands/award-badge/award-badge.request.dto.ts
interface AwardBadgeRequestDto {
  partyId: string;
  badgeType: 'WORKER_OF_THE_MONTH' | 'WORKER_OF_THE_YEAR';
  awardedByOrganizationId: string;
  period: string;
}
interface AwardBadgeResponseDto {
  badgeId: string;
}

// queries/get-public-provider-profile/get-public-provider-profile.request.dto.ts
interface GetPublicProviderProfileRequestDto {
  partyId: string;
}
interface GetPublicProviderProfileResponseDto {
  partyId: string;
  kind: 'PERSON' | 'ORGANIZATION';
  name: string | null;          // organizations only
  bio: string | null;
  skills: string[];
  tier: 'COMMUNITY' | 'VERIFIED' | 'CERTIFIED';
  trustedByCount: number;
  avgRatingCached: number | null;
  completedErrandsCount: number;
  // deliberately excludes: disputedErrandsCount, badges, avgResponseTimeSeconds — internal/org-facing only
}

// queries/get-org-facing-provider-profile/get-org-facing-provider-profile.request.dto.ts
interface GetOrgFacingProviderProfileRequestDto {
  partyId: string;
  requestingOrganizationId: string;   // authorization context — is this org allowed to see the fuller view
}
interface GetOrgFacingProviderProfileResponseDto extends GetPublicProviderProfileResponseDto {
  badges: { badgeType: string; awardedByOrganizationId: string; period: string }[];
  avgResponseTimeSeconds: number | null;
  avgInternalRatingFromOrgs: number | null;   // separate from avgRatingCached, which is client-facing only
}
```

## Open item

Should `ProviderBadge` live in this module (as shown) or be split into its own tiny `badges` module, given it's queried independently from the core `ProviderRole` aggregate and never participates in `Party`'s save/load unit? Leaning toward keeping it here for now since it's small — revisit if it grows.
