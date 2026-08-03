# Module: party

## Revision note

`ClientRole` is now added — the earlier "no client-specific data exists, any Party can post an errand by default" reasoning held until payment methods needed a home. A `Party` needs a `ClientRole` to hold `defaultPaymentMethodId` (the actual `PaymentMethod` entity lives in `payment-gateway` — gateway tokens/authorization codes belong there — `ClientRole` just holds the pointer). Auto-created alongside `Person`/`Organization` at `Party` creation, same as before, just now backed by a real row instead of being implicit.

Merges the former `client`, `provider`, `organizations` modules, built on the Party pattern (Fowler, *Analysis Patterns*) — a shared identity (`Party`) for anything that can post/apply-to errands, with structure (`Person`/`Organization`) and time-varying role data (`ClientRole`/`ProviderRole`) split into separate tables rather than one wide, nullable-heavy record.

**Capability model**: "does this party have provider capability" is "does a `ProviderRole` row exist for it." `ClientRole` now exists for every `Party` unconditionally (created at the same time as `Person`/`Organization`), since every party can post errands and needs somewhere to hold payment method references — it's not optional/added-later the way `ProviderRole` is.

## Folder placement

```
src/modules/party/
├── domain/
│   ├── entities/
│   │   ├── party.entity.ts
│   │   ├── person.entity.ts
│   │   ├── organization.entity.ts
│   │   ├── client-role.entity.ts
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
  clientRole   ClientRole?
  providerRole ProviderRole?
}

model ClientRole {
  id                     String   @id @map("_id") @db.ObjectId   // shared PK with Party
  party                  Party    @relation(fields: [id], references: [id])
  defaultPaymentMethodId String?  @db.ObjectId   // PaymentMethod lives in payment-gateway — plain scalar, cross-module reference
  createdAt              DateTime @default(now())
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

**`ClientRole`**
- `setDefaultPaymentMethod(paymentMethodId)` — no validation that the payment method is actually verified here; that check belongs in `payment-gateway` at the point of actually charging, not duplicated here

**`Organization`**
- `addMember(userId, role)` — throws `OrganizationMemberAlreadyExistsError`
- `removeMember(userId)` — throws `OrganizationMemberNotFoundError`
- `updateWorkerPoolPercentage(percentage)`

## Events

| Event | Raised by | Payload |
|---|---|---|
| `PartyCreated` | `Party.createPerson()`/`createOrganization()` | `{ partyId, kind, marketId, correlationId }` |
| `ProviderRoleAdded` | `Party.addProviderRole()` | `{ partyId, correlationId }` |
| `OrganizationMemberAdded` | `Organization.addMember()` | `{ organizationId, userId, correlationId }` |
| `OrganizationMemberRemoved` | `Organization.removeMember()` | `{ organizationId, userId, correlationId }` |
| `PartyDeactivated` | `Party.deactivate()` | `{ partyId, correlationId }` |
| `ProviderBadgeAwarded` | `AwardBadgeCommand` handler | `{ partyId, badgeType, awardedByOrganizationId, period, correlationId }` |

## Commands

| Command | Handler behavior |
|---|---|
| `CreatePersonPartyCommand` | Creates `Party{kind:PERSON}` + `Person{userId}`. Only ever dispatched internally by `OnAuthUserRegisteredHandler`, never a public route. |
| `CreateOrganizationPartyCommand` | Creates `Party{kind:ORGANIZATION}` + `Organization`. |
| `AddProviderRoleCommand` | Creates `ProviderRole{tier:COMMUNITY}` for the party; throws `ProviderRoleAlreadyExistsError` if one exists. |
| `RequestTierUpgradeCommand` | Delegates to `verification` module's `recalculateRequiredSteps` — this command mostly just kicks that off; the actual tier change happens on `VerificationCompleted`. |
| `UpdateProviderRoleCommand` | Updates `bio`/`skills`. |
| `DeactivateProviderRoleCommand` | Deactivates the `ProviderRole` only (not the whole `Party`). |
| `DeactivatePartyCommand` | Full account-level deactivation — cascades from `UserDeactivated`, see `docs/modules/notification.md`-adjacent user lifecycle. |
| `AddOrganizationMemberCommand` | Throws `OrganizationMemberAlreadyExistsError` if the `(organizationId, userId)` pair exists. |
| `RemoveOrganizationMemberCommand` | Throws `OrganizationMemberNotFoundError` otherwise. |
| `SetDefaultPaymentMethodCommand` | `{ partyId, paymentMethodId }` — validates the payment method belongs to this party and is verified (cross-module read into `payment-gateway`) before setting. |
| `AwardBadgeCommand` | Org-only action; validates the requesting org actually has/had the member. |

## Event Handlers

| Handler | Listens for | Does |
|---|---|---|
| `OnAuthUserRegisteredHandler` | `AuthUserRegistered` (ACL boundary — see `docs/flows/user-registration-flow.md`) | Dispatches `CreatePersonPartyCommand` |
| `OnVerificationCompletedHandler` | `VerificationCompleted` | Sets `verificationStatus`, updates `tier` on `ProviderRole` |
| `OnErrandCompletedHandler` | `ErrandCompleted` | Increments `completedErrandsCount` on the assigned member(s), and the org if it was the applicant |
| `OnDisputeOpenedHandler` | `DisputeOpened` | Increments `disputedErrandsCount` |
| `OnRatingSubmittedHandler` | `RatingSubmitted` (CLIENT_FACING only) | Immediate recompute of `avgRatingCached` for that one party |

## Sagas

| Saga | Trigger | Dispatches |
|---|---|---|
| `TrustedByCountSyncSaga` (consumer side) | `TrustedCircleMemberConfirmed`/`Removed` (raised in `trusted-circle`) | Increments/decrements `trustedByCount` directly (no further command needed — this is the terminal action) |

## Jobs

| Job | Schedule | Does |
|---|---|---|
| `ProviderResponseTimeRecalcJob` | Nightly | Recomputes `avgResponseTimeSeconds` from `chat`'s `firstResponseAt` data across all threads |
| `ProfileRatingRecalcJob` | Nightly | Recency-decay sweep of `avgRatingCached` for every `ProviderRole`, correcting drift between new `RatingSubmitted` events |
| `MonthlyTrustStatsJob` | Monthly | Populates dashboard stats (circles-joined, shares-received) |

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

// commands/set-default-payment-method/set-default-payment-method.request.dto.ts
interface SetDefaultPaymentMethodRequestDto {
  partyId: string;
  paymentMethodId: string;
}
interface SetDefaultPaymentMethodResponseDto {
  clientRoleId: string;
  defaultPaymentMethodId: string;
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

## Mappers

`PartyMapper`
- `toDomain(prismaParty, prismaPerson?, prismaOrganization?, prismaProviderRole?)` — assembles the full `Party` aggregate from up to 4 joined documents into one rich domain object
- `toPersistence(party: Party)` — decomposes back into the separate collections for `save()`

## Presentation

GraphQL resolvers, dispatching via `CommandBus`/`QueryBus` — never touching repositories directly.

```graphql
type Mutation {
  addProviderRole(input: AddProviderRoleInput!): AddProviderRoleResult! @auth
  updateProviderRole(input: UpdateProviderRoleInput!): Party! @auth
  requestTierUpgrade(input: RequestTierUpgradeInput!): Party! @auth
  addOrganizationMember(input: AddOrganizationMemberInput!): Organization! @auth(role: ["OWNER", "ADMIN"])
  removeOrganizationMember(input: RemoveOrganizationMemberInput!): Organization! @auth(role: ["OWNER", "ADMIN"])
  awardBadge(input: AwardBadgeInput!): ProviderBadge! @auth(role: ["OWNER", "ADMIN"])
  setDefaultPaymentMethod(input: SetDefaultPaymentMethodInput!): ClientRole! @auth
}
type Query {
  publicProviderProfile(partyId: ID!): ProviderProfile
  orgFacingProviderProfile(partyId: ID!): OrgFacingProviderProfile @auth
  searchProvidersByService(categoryId: ID!, marketId: ID!): [ProviderProfile!]!
}
```

`createPersonParty` has **no `Mutation` field** — internal only, triggered by the ACL event handler, never reachable from the API layer.

## Open item

**Resolved**: `ProviderBadge` stays in `party` permanently — it's small, directly tied to `ProviderRole`, and doesn't warrant its own module.
