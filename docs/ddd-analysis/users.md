# Users — DDD & EIP Analysis

## 1. Current Responsibility

Manages user profiles and addresses:

- User CRUD: `findOne`, `update` (profile fields, role assignment, profile image upload).
- Address management: `addAddress`, `deleteAddress`, `setActiveAddress`.
- Profile image upload to Firebase Storage.
- Onboarding progress tracking (for providers).
- Emits `user.updated` event when profile changes (via `globalEventEmitter`).

**Files**: `users.service.ts` (~400 lines), `users.resolver.ts`, `users.module.ts`, DTOs.

## 2. Bounded Context Assessment

**This is a supporting sub-domain**, not a core bounded context.

- User profile is shared across Client and Provider contexts (a user can have both roles).
- User is a **shared kernel** — multiple bounded contexts depend on it (Errands, Chat, Notification, Provider, Client).

**Overlaps**:

- **Address**: Address management is in Users module, but there's also a separate `Address` module (likely for geocoding/place search) — potential duplication.
- **Auth**: User creation is triggered by Auth module, but profile management is here.
- **Provider/Client**: User has `activeRole` (CLIENT | PROVIDER) and can switch, but Provider and Client modules each have their own entities (`Provider`, `Client` Prisma models).

**Verdict**: Users is a **shared kernel bounded context** — it provides identity and profile data to other contexts.

## 3. Domain Model Audit

**Anemic models**:

- `User` (Prisma model) is a data bag with fields: `name`, `email`, `phoneNumber`, `activeRole`, `onboardingProgress`, etc.
- No domain behavior:
  - No `User.updateProfile()` method encapsulating validation rules.
  - No `User.addRole()` method enforcing role-switching constraints.
  - No `User.verifyEmail()`, `User.verifyPhone()` (verification is in separate Verification module).

**Aggregate boundaries**:

- **`User`** should be the aggregate root, owning:
  - `UserAddress` (child entity — addresses are created/deleted with user).
  - `Session` (child entity — sessions belong to user).
  - `Account` (child entity — OAuth accounts).

- **Invariants**:
  - User must have at least one verified contact (email OR phone) to perform actions.
  - Active address must be one of user's registered addresses (currently enforced at DB level via relation, not domain layer).

**Invariants currently unenforced**:

1. **Role switching**:
   - `update` (line 34) adds role to `roles` array and sets `activeRole` (line 42-47).
   - No validation: Can user switch to PROVIDER role if they don't have a Provider profile? (Likely causes bugs.)
2. **Active address consistency**:
   - `addAddress` (line 81) auto-sets new address as active (line 95-99).
   - `deleteAddress` (line 110) does NOT unset active address if deleting the active one — leaves dangling reference (critical bug).
3. **Onboarding progress**:
   - `updateOnboardingProgress` is called after adding address (line 106), but logic is likely scattered (incomplete domain model).

## 4. Layering Violations

**Business logic in service**:

- `update` (line 34-88) orchestrates:
  - Profile image upload (infrastructure: Firebase Storage, line 51-54).
  - Prisma update (data access).
  - Event emission (application logic, line 73).
  - Image deletion (infrastructure cleanup, line 63).

  This is an **application service use case**, not a domain service.

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.user.*`).
- No repository abstraction.

**Infrastructure in service**:

- `uploadUserImage` (line 175+) uploads to Firebase Storage — infrastructure concern in service layer.
- Image upload should be in infrastructure adapter, called by application layer.

**Global event emitter**:

- Uses `globalEventEmitter` (line 9, line 73) instead of NestJS `EventEmitter2` — inconsistent with other modules.
- Why global emitter? (Likely a workaround for event emitter not being available in all contexts.)

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IUserRepository (interface)
    - findById(id): User | null
    - findByEmail(email): User | null
    - save(user): void
    - findAddressesByUserId(userId): UserAddress[]
infrastructure/
  PrismaUserRepository (implementation)
```

**Consolidation**: All `prisma.user.*` and `prisma.userAddress.*` calls move to repository.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **UserProfileUpdated event**:
   - Current: `globalEventEmitter.emit('user.updated', ...)` (line 73).
   - Proposed: `UserProfileUpdated` typed event.
   - Listeners:
     - Payment-Gateway updates Paystack customer profile (already listens, see `payment-gateway.events.ts`).
     - Notification sends profile update confirmation.
     - Search/recommendation engine reindexes user.

2. **AddressAdded / AddressDeleted events**:
   - Not currently emitted.
   - Could trigger:
     - Geolocation validation (verify address is real via Google Maps API).
     - Update nearby errands feed (if user moves).

3. **UserRoleChanged event**:
   - When user switches `activeRole`, emit event.
   - Listeners:
     - Provider module initializes provider profile if switching to PROVIDER for first time.
     - Client module initializes client profile if switching to CLIENT for first time.

**Dead Letter / Retry**:

- Profile image upload (line 51-54) can fail (Firebase timeout).
- No retry — user sees error and must re-upload.
- Recommendation: Queue image upload as background job (BullMQ), retry 3x.

**Aggregator**:

- `findOne` (line 22) aggregates user + activeAddress + provider + userAddress via Prisma include — this is data aggregation, fine for a query.

## 7. Cross-Cutting Concerns

**Validation**:

- `update` does minimal validation: checks if image file is actually an image (line 44-46).
- No validation for:
  - Email format (handled by better-auth during sign-up, but what if user updates email?).
  - Phone number format (international phone numbers need regex validation).
  - Name length (can user set name to empty string?).

**Transactions**:

- `update` does NOT use explicit transaction, but includes multiple operations:
  1. Upload image.
  2. Update user.
  3. Delete old image.

  If step 3 fails, old image remains in storage (orphaned file) — no cleanup.

- `addAddress` does NOT use transaction:
  1. Create address.
  2. Set as active address.

  If step 2 fails, address is created but not active (user has orphaned address).

**Error handling**:

- Throws `BadRequestException` for business errors (line 45, line 115, line 137).
- No domain exceptions (`InvalidEmailFormat`, `AddressNotFound`).

## 8. GraphQL-Specific Notes

**GraphQL types**:

- `User` entity is likely 1:1 with Prisma model (check `entities/user.entity.ts`).
- `GqlUserRole` and `GqlOnboardingProgress` enums (line 9) are GraphQL wrappers for Prisma enums.

**N+1 risk**:

- `findOne` (line 22) uses Prisma include to fetch related data — single query, no N+1.
- If client code queries `users { provider { services } }`, potential N+1 for services.
- No DataLoader.

**Authorization**:

- No auth checks in UsersService — assumes caller (resolver) already validated user can update their own profile.
- Risky if resolver doesn't enforce this (e.g., can user A update user B's profile?).

## 9. Target Structure

```
src/users/
  domain/
    entities/
      User.ts                       # Aggregate root with updateProfile(), addAddress(), setActiveAddress()
      UserAddress.ts                # Child entity
    value-objects/
      Email.ts                      # Validates email format
      PhoneNumber.ts                # Validates phone format (international)
    repositories/
      IUserRepository.ts            # Interface: findById, findByEmail, save
    events/
      UserProfileUpdated.ts
      UserAddressAdded.ts
      UserRoleChanged.ts

  application/
    commands/
      UpdateUserProfile/
        UpdateUserProfileCommand.ts
        UpdateUserProfileHandler.ts  # Use case: validate, upload image, update user, emit event
      AddAddress/
        AddAddressCommand.ts
        AddAddressHandler.ts
      DeleteAddress/
        DeleteAddressCommand.ts
        DeleteAddressHandler.ts
    queries/
      GetUserProfile/
        GetUserProfileQuery.ts
        GetUserProfileHandler.ts

  infrastructure/
    repositories/
      PrismaUserRepository.ts       # Implements IUserRepository
    storage/
      FirebaseImageUploader.ts      # Adapter for Firebase Storage

  presentation/
    resolvers/
      UsersResolver.ts
    types:
      UserType.ts
```

---

## 10. Schema Findings

**Context**: Analysis of `prisma/model/schema.prisma` (User and UserAddress models).

### Aggregate Boundary Violations

**None found for User aggregate** — no other modules directly mutate User.activeAddressId or User fields. User aggregate integrity is intact at schema level.

**Note**: Auth module creates users, but this is appropriate (Auth is the entry point for user creation).

### Dangling Reference Risks

1. **User.activeAddressId → UserAddress** (CRITICAL BUG — already documented)
   - **Schema**: `User.activeAddress` relation has `onDelete: NoAction, onUpdate: NoAction`.
   - **Bug**: Deleting UserAddress doesn't check if it's the active address — leaves dangling `activeAddressId`.
   - **Evidence**: `src/users/users.service.ts` `deleteAddress` method (line ~110) does NOT nullify `activeAddressId` before deletion.
   - **Impact**: **URGENT** — GraphQL queries resolving `User.activeAddress` will fail or return null unexpectedly.
   - **Current cleanup**: None.
   - **Fix** (already documented in Critical Issues):
     ```typescript
     async deleteAddress(userId: string, addressId: string) {
       const user = await this.prisma.user.findUnique({ where: { id: userId } });
       if (user.activeAddressId === addressId) {
         await this.prisma.user.update({
           where: { id: userId },
           data: { activeAddressId: null },
         });
       }
       await this.prisma.userAddress.delete({ where: { id: addressId } });
     }
     ```
   - **Backfill script** (clean production data):
     ```typescript
     // scripts/fix-dangling-active-addresses.ts
     async function fixDanglingActiveAddresses() {
       const users = await prisma.user.findMany({
         where: { activeAddressId: { not: null } },
       });
       for (const user of users) {
         const addressExists = await prisma.userAddress.findUnique({
           where: { id: user.activeAddressId },
         });
         if (!addressExists) {
           await prisma.user.update({
             where: { id: user.id },
             data: { activeAddressId: null },
           });
           console.log(`Fixed dangling activeAddressId for user ${user.id}`);
         }
       }
     }
     ```
   - **Migration**: Code deployment (fix service) + backfill script.
   - **Rollback**: Code revert (but backfill is one-way cleanup).
   - **Priority**: **PHASE 1 (URGENT)**.

2. **UserAddress.userId → User**
   - **Schema**: `UserAddress.user` relation has no `onDelete` specified (defaults to Prisma client-side handling).
   - **Bug**: No bug here — UserAddress is owned by User (deleting User should cascade to UserAddress).
   - **Expected behavior**: Deleting User should delete all UserAddress records.
   - **Current schema**: Prisma will handle this client-side (safe).
   - **Recommendation**: Explicitly add `onDelete: Cascade` for clarity:
     ```prisma
     model UserAddress {
       user User @relation(fields: [userId], references: [id], onDelete: Cascade)
     }
     ```
   - **Priority**: PHASE 2 (low urgency, schema clarity improvement).

3. **Session.userId → User, Account.userId → User, TwoFactor.userId → User**
   - **Schema**: All have `onDelete: Cascade` ✅ (confirmed safe).
   - **No action needed**.

4. **Provider.userId → User, Client.userId → User**
   - **Schema**: Both have `onDelete: Cascade` ✅ (confirmed safe).
   - **No action needed**.

### Missing Indexes

**All critical indexes already present** (analysis confirmed):

- `@@unique([email])` ✅ (also functions as index)
- `@@unique([username])` ✅
- `User.activeAddressId` — **No index**, but not needed (relation lookup uses UserAddress.id primary key, not activeAddressId index).

**UserAddress**:

- No indexes on `UserAddress.userId` — **MISSING** (needed for querying user's addresses).
- **Query pattern**: `UsersService.findOne` includes user addresses (`userAddress: true`).
- **Impact**: Currently OK (Prisma resolves via relation), but explicit index would improve performance.
- **Fix**: Add `@@index([userId])` to UserAddress model.
- **Priority**: PHASE 2 (low urgency, performance optimization).

**Schema change**:

```prisma
model UserAddress {
  // ... existing fields ...

  @@index([userId])
  @@map("user_addresses")
}
```

**Migration**: `npx prisma db push` (additive).
**Rollback**: Safe (drop index).

### Embed vs. Reference Decisions

**UserAddress as child entity** (current approach is correct):

- **Decision**: Keep UserAddress as separate collection with reference to User.
- **Justification**:
  - User can have multiple addresses (1:N relation).
  - Addresses are queried independently (get all addresses for user).
  - Embedding would duplicate data if user has many addresses.
- **No schema change needed**.

### Migration / Rollback Strategy

**Phase 1 changes for Users** (URGENT):

1. **Fix deleteAddress dangling-reference bug** (code + backfill):
   - Update `UsersService.deleteAddress` to nullify activeAddressId.
   - Run `scripts/fix-dangling-active-addresses.ts` on production.
   - Migration: Code deployment + manual backfill script run.
   - Rollback: Code revert (backfill cannot be rolled back, but it's safe cleanup).
   - Risk: LOW (simple code change, idempotent backfill).

**Phase 2 changes for Users**:

1. **Add explicit cascade to UserAddress** (schema clarity):
   - Add `onDelete: Cascade` to `UserAddress.user` relation.
   - Migration: `npx prisma db push`.
   - Rollback: Safe (remove cascade, Prisma client-side handling remains).
   - Risk: LOW.

2. **Add index on UserAddress.userId** (performance):
   - Migration: `npx prisma db push`.
   - Rollback: Safe (drop index).
   - Risk: LOW.

3. **Extract User aggregate** (code-only):
   - Create `User.addAddress()`, `User.deleteAddress()`, `User.setActiveAddress()` methods.
   - Emit events: `UserCreated`, `AddressAdded`, `AddressDeleted`.
   - Migration: Code deployment.
   - Rollback: Code revert.
   - Risk: MEDIUM (User module is shared kernel — many modules depend on it).

**Risk revised from HIGH to LOW-MEDIUM**: Schema changes are minimal (1 urgent bug fix, 2 optional improvements). Main risk is User aggregate extraction (Phase 2) due to cross-module dependencies.

**Mitigation**: Fix activeAddressId bug immediately (Phase 1), defer aggregate extraction to Phase 2 after event infrastructure is stable.

---

## 11. Migration Risk & Priority

**Risk**: **HIGH**

- User is a shared kernel — many modules depend on it (Errands, Chat, Provider, Client, Notification).
- Breaking changes to User module could cascade across the entire system.
- Address management has a critical bug (deleting active address leaves dangling reference).

**Priority**: **PHASE 2 (after Escrow/Application, before Errands)**
**Rationale**:

1. User module is foundational but not as tightly coupled to critical money flows as Escrow/Application.
2. Refactoring User module enables cleaner integration with Provider/Client modules (Phase 2).
3. Fixing address deletion bug is urgent but can be patched without full refactoring (quick fix: set activeAddress to null if deleted).

**Migration steps**:

1. **URGENT: Fix address deletion bug** (set activeAddressId to null if deleting active address).
2. **Extract Email and PhoneNumber value objects** for validation.
3. **Create User aggregate** with `updateProfile()`, `addAddress()`, `deleteAddress()` methods enforcing invariants.
4. **Introduce IUserRepository** and `PrismaUserRepository`.
5. **Create command handlers**: `UpdateUserProfileHandler`, `AddAddressHandler`.
6. **Emit typed events**: `UserProfileUpdated`, `UserAddressAdded`.
7. **Move image upload to infrastructure adapter** (decouple from service).
8. **Replace globalEventEmitter with NestJS EventEmitter2** for consistency.
9. **Add authorization checks** (resolver validates user can only update own profile).
