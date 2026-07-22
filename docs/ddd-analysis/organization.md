# Organization — DDD & EIP Analysis

## 1. Current Responsibility

Manages organizations (business entities) and their members:

- **Get my organization**: `getMyOrganization` (line 8-45) fetches organization where user is a member (or owner).

**Files**: `organization.service.ts` (~45 lines), `organization.resolver.ts`, `organization.module.ts`.

## 2. Bounded Context Assessment

**This is a separate bounded context** for "Organization Management" (business accounts).

- Organization is a **distinct aggregate** — a business entity with members, distinct from individual providers.
- However, Organization is **underdeveloped** — only has one query method (likely placeholder for future features).

**Overlaps**:

- **Provider**: Provider can have `providerType === ORGANIZATION` (individual vs. organization worker).
- **Users**: Organization has `ownerId` (user who created org) and `members` (OrgMember join table).

**Verdict**: Organization is a **separate bounded context** if complex (billing, teams, roles). If simple (just group providers), merge into Provider module.

## 3. Domain Model Audit

**Anemic models**:

- `Organization` (Prisma model) is a data bag with `name`, `ownerId`, `members`.
  - No behavior: No `Organization.addMember()`, `Organization.removeMember()`, `Organization.assignRole()` methods.
- `OrgMember` (Prisma model) is a data bag with `userId`, `orgId`, `role`, `active`.
  - No behavior.

**Aggregate boundaries**:

- **`Organization`** should be the aggregate root, owning:
  - `OrgMember` (child entity — members belong to organization).
  - Invariants: Owner must exist, members must have valid roles, organization must have at least one owner.

**Invariants currently unenforced**:

1. **Role validation**:
   - No validation that member role is valid (OWNER | ADMIN | MEMBER).
2. **Owner requirement**:
   - No validation that organization has at least one owner (if original owner leaves, org is orphaned).

## 4. Layering Violations

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.organization.*`, `this.prisma.orgMember.*`).
- No repository abstraction.

**Incomplete implementation**:

- `getMyOrganization` (line 8-45) is the ONLY method — no create, update, add member, remove member.
- This suggests Organization is a placeholder (not fully implemented).

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IOrganizationRepository (interface)
    - findById(id): Organization | null
    - findByOwnerId(ownerId): Organization[]
    - save(organization): void
infrastructure/
  PrismaOrganizationRepository (implementation)
```

## 6. EIP Opportunities

**Command/Event patterns** (for future implementation):

1. **OrganizationCreated event**:
   - When user creates organization, emit event.
   - Listeners:
     - Notification sends "organization created" confirmation.
     - Analytics tracks business accounts.

2. **MemberAddedToOrganization event**:
   - When user is added to org, emit event.
   - Listeners:
     - Notification sends "you've been added to X organization" email.

## 7. Cross-Cutting Concerns

**Validation**:

- No validation in service (minimal implementation).

**Transactions**:

- No write operations in service.

## 8. GraphQL-Specific Notes

**Authorization**:

- `getMyOrganization` should validate user can only view organizations they belong to.

## 9. Target Structure

```
src/organization/
  domain/
    entities/
      Organization.ts               # Aggregate root with addMember(), removeMember()
      OrgMember.ts                  # Child entity
    value-objects/
      OrgRole.ts                    # OWNER | ADMIN | MEMBER
    repositories/
      IOrganizationRepository.ts
    events/
      OrganizationCreated.ts
      MemberAddedToOrganization.ts

  application/
    commands/
      CreateOrganization/
        CreateOrganizationCommand.ts
        CreateOrganizationHandler.ts
      AddMember/
        AddMemberCommand.ts
        AddMemberHandler.ts
    queries/
      GetMyOrganization/
        GetMyOrganizationQuery.ts
        GetMyOrganizationHandler.ts

  infrastructure/
    repositories/
      PrismaOrganizationRepository.ts

  presentation/
    resolvers/
      OrganizationResolver.ts
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Organization is underdeveloped (only one query method) — minimal functionality to break.

**Priority**: **PHASE 3 (after core domain modules) OR DEFER**
**Rationale**:

1. Organization is not currently used in core flows (errands, payments) — can defer implementation.
2. If organization features are needed (business accounts, teams, billing), implement fully in Phase 3.
3. If organization is just a placeholder (not in MVP), remove module and revisit later.

**Migration steps**:

1. **Decide**: Is Organization in MVP? If not, defer.
2. **If implementing**:
   - Extract Organization aggregate with `addMember()`, `removeMember()` methods.
   - Introduce IOrganizationRepository and `PrismaOrganizationRepository`.
   - Create command handlers (CreateOrganization, AddMember, RemoveMember).
   - Emit events: `OrganizationCreated`, `MemberAddedToOrganization`.

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Organization aggregate root.
 * Maps to Organization fields: id, name, type, createdAt, ownerId.
 */
class OrganizationAggregate {
  constructor(
    public readonly id: string,
    private name: string,
    private type: OrgType,
    public readonly createdAt: Date,
    public readonly ownerId: string,
    private members: OrgMemberAggregate[],
  );

  /**
   * Adds member with role into organization.
   * Writes OrgMember fields: id, orgId, userId, role, active.
   */
  addMember(userId: string, role: OrgRole): void;

  /**
   * Removes member from organization by userId.
   */
  removeMember(userId: string): void;

  /**
   * Deactivates member without deleting row by setting active = false.
   */
  deactivateMember(userId: string): void;
}

/**
 * Child entity mapped from OrgMember model.
 */
class OrgMemberAggregate {
  constructor(
    public readonly id: string,
    public readonly orgId: string,
    public readonly userId: string,
    public readonly role: OrgRole,
    public readonly active: boolean,
  );
}
```

### Repository Interface

```typescript
/**
 * Persistence contract for Organization aggregate.
 */
interface IOrganizationRepository {
  /**
   * Finds organization by Organization.id.
   */
  findById(id: string): Promise<OrganizationAggregate | null>;

  /**
   * Finds organizations by ownerId.
   */
  findByOwnerId(ownerId: string): Promise<OrganizationAggregate[]>;

  /**
   * Finds organization membership by OrgMember.userId.
   */
  findByMemberUserId(userId: string): Promise<OrganizationAggregate | null>;

  /**
   * Persists organization and member changes.
   */
  save(organization: OrganizationAggregate): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Creates a new organization and initial owner membership.
 */
class CreateOrganizationCommandHandler {
  /**
   * Creates Organization and emits OrganizationCreatedEvent.
   */
  execute(command: CreateOrganizationCommand): Promise<string>;
}

interface CreateOrganizationCommand {
  name: string;
  type: OrgType;
  ownerUserId: string;
}

/**
 * Adds a member to an existing organization.
 */
class AddOrganizationMemberCommandHandler {
  /**
   * Adds OrgMember row and emits MemberAddedToOrganizationEvent.
   */
  execute(command: AddOrganizationMemberCommand): Promise<void>;
}

interface AddOrganizationMemberCommand {
  organizationId: string;
  userId: string;
  role: OrgRole;
}
```

### Domain Events

```typescript
/**
 * Emitted when organization is created.
 */
class OrganizationCreatedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly ownerId: string,
    public readonly type: OrgType,
  );
}

/**
 * Emitted when user is added as an organization member.
 */
class MemberAddedToOrganizationEvent {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly role: OrgRole,
  );
}
```
