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

---

## 12. Implementation Spec

### Domain Layer

````typescript
/**
 * User aggregate root representing a platform user (shared kernel).
 * Core invariants:
 * - User must have at least one verified contact (email OR phone)
 * - activeAddressId must reference one of user's own addresses
 * - Cannot switch to PROVIDER role without Provider profile
 * - Cannot switch to CLIENT role without Client profile
 * - Email and phone must be unique across platform
 */
class User {
  /**
   * Private constructor - use User.create() factory or load from repository.
   * @param id Unique user identifier (from schema: id String @id)
   * @param name User's full name (from schema: name String?)
   * @param email Email address (from schema: email String? @unique)
   * @param phoneNumber Phone number (from schema: phoneNumber String? @unique)
   * @param emailVerified Email verification status (from schema: emailVerified Boolean)
   * @param phoneVerified Phone verification status (from schema: phoneVerified Boolean)
   * @param image Profile image URL (from schema: image String?)
   * @param roles User roles array (from schema: roles Role[])
   * @param activeRole Currently active role (from schema: activeRole Role?)
   * @param activeAddressId Active address ID (from schema: activeAddressId String?)
   * @param onboardingProgress Onboarding completion fields (from schema: hasCompletedProfile, etc.)
   * @param addresses Child entities (from schema: UserAddress[])
   * @param createdAt Creation timestamp
   * @param updatedAt Last update timestamp
   */
  private constructor(
    public readonly id: string,
    private name: string | null,
    private email: Email | null,
    private phoneNumber: PhoneNumber | null,
    private emailVerified: boolean,
    private phoneVerified: boolean,
    private image: string | null,
    private roles: Role[],
    private activeRole: Role | null,
    private activeAddressId: string | null,
    private onboardingProgress: OnboardingProgress,
    private readonly addresses: UserAddress[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**\n   * Factory method to create new user (called by auth module during registration).\n   * User starts with no roles - roles are added when Provider/Client profiles created.\n   * @param email Email address (optional - can register with phone only)\n   * @param phoneNumber Phone number (optional - can register with email only)\n   * @param name Optional name\n   * @throws NoContactProvidedError when both email and phone are null\n   * @returns New User instance with empty roles\n   */\n  static create(\n    email?: string,\n    phoneNumber?: string,\n    name?: string,\n  ): User;\n\n  /**\n   * Updates user profile (name, image, phone, email).\n   * Image upload happens in infrastructure layer - this just stores URL.\n   * @param updates Profile updates\n   * @throws InvalidEmailError when email format invalid\n   * @throws InvalidPhoneNumberError when phone format invalid\n   * @emits UserProfileUpdatedEvent\n   */\n  updateProfile(updates: Partial<UserProfileUpdates>): void;\n\n  /**\n   * Adds new address to user's address collection.\n   * First address added becomes active address automatically.\n   * @param street Street address\n   * @param city City\n   * @param state State\n   * @param country Country\n   * @param placeId Optional Google Places ID\n   * @param coordinates Optional GPS coordinates\n   * @returns New UserAddress ID\n   * @emits AddressAddedEvent\n   */\n  addAddress(\n    street: string,\n    city: string,\n    state: string,\n    country: string,\n    placeId?: string,\n    coordinates?: [number, number],\n  ): string;\n\n  /**\n   * Deletes address from user's collection.\n   * CRITICAL: Sets activeAddressId to null if deleting active address.\n   * @param addressId Address ID to delete\n   * @throws AddressNotFoundError when address doesn't belong to user\n   * @emits AddressDeletedEvent\n   */\n  deleteAddress(addressId: string): void;\n\n  /**\n   * Sets active address (used for location-based queries).\n   * @param addressId Address ID to set as active\n   * @throws AddressNotFoundError when address doesn't belong to user\n   * @emits ActiveAddressChangedEvent\n   */\n  setActiveAddress(addressId: string): void;\n\n  /**\n   * Adds role to user (called when Provider or Client profile created).\n   * @param role Role to add (PROVIDER or CLIENT)\n   * @throws RoleAlreadyExistsError when user already has role\n   * @emits RoleAddedEvent\n   */\n  addRole(role: Role): void;\n\n  /**\n   * Switches active role (user toggles between CLIENT and PROVIDER modes).\n   * @param role Role to switch to\n   * @throws RoleNotAssignedError when user doesn't have this role\n   * @emits ActiveRoleChangedEvent\n   */\n  switchRole(role: Role): void;\n\n  /**\n   * Marks email as verified.\n   * @emits EmailVerifiedEvent\n   */\n  verifyEmail(): void;\n\n  /**\n   * Marks phone as verified.\n   * @emits PhoneVerifiedEvent\n   */\n  verifyPhone(): void;\n\n  /**\n   * Updates onboarding progress (for providers).\n   * Tracks completion of profile, address, bio, skills, etc.\n   * @param field Onboarding field to mark complete\n   */\n  markOnboardingComplete(field: OnboardingField): void;\n\n  /**\n   * Checks if user has at least one verified contact method.\n   */\n  hasVerifiedContact(): boolean;\n\n  /**\n   * Returns active address or null.\n   */\n  getActiveAddress(): UserAddress | null;\n}\n\n/**\n * UserAddress child entity (owned by User aggregate).\n * Immutable once created - addresses are deleted/recreated, not edited.\n */\nclass UserAddress {\n  constructor(\n    public readonly id: string,\n    public readonly userId: string,\n    public readonly street: string,\n    public readonly city: string,\n    public readonly state: string,\n    public readonly country: string,\n    public readonly placeId: string | null,\n    public readonly coordinates: [number, number] | null,\n    public readonly createdAt: Date,\n  );\n}\n\n/**\n * Email value object with validation.\n * Immutable.\n */\nclass Email {\n  /**\n   * @param value Email string\n   * @throws InvalidEmailError when format invalid\n   */\n  constructor(public readonly value: string);\n\n  /**\n   * Returns lowercase normalized email.\n   */\n  toString(): string;\n}\n\n/**\n * Phone number value object with validation.\n * Immutable.\n */\nclass PhoneNumber {\n  /**\n   * @param value Phone string (E.164 format recommended: +2348012345678)\n   * @throws InvalidPhoneNumberError when format invalid\n   */\n  constructor(public readonly value: string);\n\n  /**\n   * Returns normalized phone number.\n   */\n  toString(): string;\n}\n\n/**\n * Onboarding progress tracker (value object).\n */\nclass OnboardingProgress {\n  constructor(\n    public readonly hasCompletedProfile: boolean,\n    public readonly hasAddedBio: boolean,\n    public readonly hasAddedSkills: boolean,\n    public readonly hasAddedAddress: boolean,\n  );\n\n  /**\n   * Checks if onboarding is complete (all fields true).\n   */\n  isComplete(): boolean;\n}\n\ninterface UserProfileUpdates {\n  name?: string;\n  email?: string;\n  phoneNumber?: string;\n  image?: string; // URL, not file - upload happens in infrastructure\n}\n\nenum OnboardingField {\n  PROFILE = 'hasCompletedProfile',\n  BIO = 'hasAddedBio',\n  SKILLS = 'hasAddedSkills',\n  ADDRESS = 'hasAddedAddress',\n}\n\n/** Thrown when user tries to register without email or phone. */\nclass NoContactProvidedError extends Error {}\n\n/** Thrown when email format invalid. */\nclass InvalidEmailError extends Error {}\n\n/** Thrown when phone format invalid. */\nclass InvalidPhoneNumberError extends Error {}\n\n/** Thrown when address doesn't belong to user. */\nclass AddressNotFoundError extends Error {}\n\n/** Thrown when user already has role. */\nclass RoleAlreadyExistsError extends Error {}\n\n/** Thrown when user tries to switch to role they don't have. */\nclass RoleNotAssignedError extends Error {}\n```\n\n### Repository Interface\n\n```typescript\n/**\n * Persistence contract for User aggregate (shared kernel).\n */\ninterface IUserRepository {\n  /**\n   * Finds user by unique ID.\n   * @param id User ID\n   * @returns User aggregate or null if not found\n   */\n  findById(id: string): Promise<User | null>;\n\n  /**\n   * Finds user by email.\n   * @param email Email address\n   * @returns User aggregate or null if not found\n   */\n  findByEmail(email: string): Promise<User | null>;\n\n  /**\n   * Finds user by phone number.\n   * @param phoneNumber Phone number\n   * @returns User aggregate or null if not found\n   */\n  findByPhoneNumber(phoneNumber: string): Promise<User | null>;\n\n  /**\n   * Persists user aggregate.\n   * @param user User to save\n   */\n  save(user: User): Promise<void>;\n\n  /**\n   * Finds all addresses for user.\n   * @param userId User ID\n   * @returns Array of UserAddress entities\n   */\n  findAddresses(userId: string): Promise<UserAddress[]>;\n}\n```\n\n### Application Layer\n\n```typescript\n/**\n * Updates user profile.\n */\nclass UpdateUserProfileCommandHandler {\n  /**\n   * @param command Profile update details\n   * @throws UserNotFoundException when user doesn't exist\n   * @throws InvalidEmailError when email format invalid\n   * @throws InvalidPhoneNumberError when phone format invalid\n   * @throws UnauthorizedException when updatedBy is not user themselves\n   * @emits UserProfileUpdatedEvent\n   */\n  execute(command: UpdateUserProfileCommand): Promise<void>;\n}\n\ninterface UpdateUserProfileCommand {\n  userId: string;\n  updatedBy: string; // must match userId for authorization\n  updates: Partial<UserProfileUpdates>;\n}\n\n/**\n * Adds address to user profile.\n */\nclass AddAddressCommandHandler {\n  /**\n   * @param command Address details\n   * @throws UserNotFoundException when user doesn't exist\n   * @emits AddressAddedEvent\n   * @returns Address ID\n   */\n  execute(command: AddAddressCommand): Promise<string>;\n}\n\ninterface AddAddressCommand {\n  userId: string;\n  street: string;\n  city: string;\n  state: string;\n  country: string;\n  placeId?: string;\n  coordinates?: [number, number];\n}\n\n/**\n * Deletes address from user profile.\n * CRITICAL: Handles activeAddressId cleanup.\n */\nclass DeleteAddressCommandHandler {\n  /**\n   * @param command Address to delete\n   * @throws UserNotFoundException when user doesn't exist\n   * @throws AddressNotFoundError when address doesn't belong to user\n   * @emits AddressDeletedEvent\n   */\n  execute(command: DeleteAddressCommand): Promise<void>;\n}\n\ninterface DeleteAddressCommand {\n  userId: string;\n  addressId: string;\n}\n\n/**\n * Sets active address.\n */\nclass SetActiveAddressCommandHandler {\n  /**\n   * @param command Address to set as active\n   * @throws UserNotFoundException when user doesn't exist\n   * @throws AddressNotFoundError when address doesn't belong to user\n   * @emits ActiveAddressChangedEvent\n   */\n  execute(command: SetActiveAddressCommand): Promise<void>;\n}\n\ninterface SetActiveAddressCommand {\n  userId: string;\n  addressId: string;\n}\n\n/**\n * Adds role to user (called when Provider or Client profile created).\n */\nclass AddRoleCommandHandler {\n  /**\n   * @param command Role to add\n   * @throws UserNotFoundException when user doesn't exist\n   * @throws RoleAlreadyExistsError when user already has role\n   * @emits RoleAddedEvent\n   */\n  execute(command: AddRoleCommand): Promise<void>;\n}\n\ninterface AddRoleCommand {\n  userId: string;\n  role: Role;\n}\n\n/**\n * Switches user's active role (toggle between CLIENT and PROVIDER).\n */\nclass SwitchRoleCommandHandler {\n  /**\n   * @param command Role to switch to\n   * @throws UserNotFoundException when user doesn't exist\n   * @throws RoleNotAssignedError when user doesn't have this role\n   * @emits ActiveRoleChangedEvent\n   */\n  execute(command: SwitchRoleCommand): Promise<void>;\n}\n\ninterface SwitchRoleCommand {\n  userId: string;\n  role: Role;\n}\n\n/**\n * Uploads profile image to Firebase Storage.\n * Infrastructure service (called by UpdateUserProfileCommandHandler).\n */\nclass UploadProfileImageService {\n  /**\n   * Uploads image file to Firebase Storage and returns URL.\n   * Deletes old image if replacing.\n   * @param userId User ID (used in storage path)\n   * @param imageFile Uploaded file buffer\n   * @param oldImageUrl Optional old image URL to delete\n   * @returns Firebase Storage URL\n   * @throws ImageUploadError when upload fails\n   */\n  uploadImage(\n    userId: string,\n    imageFile: Buffer,\n    oldImageUrl?: string,\n  ): Promise<string>;\n}\n\n/**\n * Query handler: Get user by ID.\n */\nclass GetUserQueryHandler {\n  /**\n   * @param query User ID\n   * @returns User details with addresses\n   * @throws UserNotFoundException when not found\n   */\n  execute(query: GetUserQuery): Promise<UserDTO>;\n}\n\ninterface GetUserQuery {\n  userId: string;\n}\n\ninterface UserDTO {\n  id: string;\n  name: string | null;\n  email: string | null;\n  phoneNumber: string | null;\n  emailVerified: boolean;\n  phoneVerified: boolean;\n  image: string | null;\n  roles: Role[];\n  activeRole: Role | null;\n  activeAddress: UserAddressDTO | null;\n  addresses: UserAddressDTO[];\n  onboardingProgress: {\n    hasCompletedProfile: boolean;\n    hasAddedBio: boolean;\n    hasAddedSkills: boolean;\n    hasAddedAddress: boolean;\n    isComplete: boolean;\n  };\n  createdAt: Date;\n}\n\ninterface UserAddressDTO {\n  id: string;\n  street: string;\n  city: string;\n  state: string;\n  country: string;\n  placeId: string | null;\n  coordinates: [number, number] | null;\n  createdAt: Date;\n}\n```\n\n### Domain Events\n\n```typescript\n/**\n * Emitted when user profile updated.\n * Consumed by: Payment-Gateway (update Paystack customer), Notification, Search indexer\n */\nclass UserProfileUpdatedEvent {\n  constructor(\n    public readonly userId: string,\n    public readonly updates: Partial<UserProfileUpdates>,\n  ) {}\n}\n\n/**\n * Emitted when address added.\n * Consumed by: Geolocation service (validate address), Errands (update feed)\n */\nclass AddressAddedEvent {\n  constructor(\n    public readonly userId: string,\n    public readonly addressId: string,\n    public readonly address: UserAddress,\n  ) {}\n}\n\n/**\n * Emitted when address deleted.\n * CRITICAL: Triggers cleanup in modules referencing addresses.\n * Consumed by: Errands (if errand serviceAddress references deleted address)\n */\nclass AddressDeletedEvent {\n  constructor(\n    public readonly userId: string,\n    public readonly addressId: string,\n  ) {}\n}\n\n/**\n * Emitted when active address changed.\n * Consumed by: Errands (update feed based on new location), Provider (update service area)\n */\nclass ActiveAddressChangedEvent {\n  constructor(\n    public readonly userId: string,\n    public readonly newActiveAddressId: string | null,\n  ) {}\n}\n\n/**\n * Emitted when role added to user.\n * Consumed by: Provider module (initialize Provider profile), Client module (initialize Client profile)\n */\nclass RoleAddedEvent {\n  constructor(\n    public readonly userId: string,\n    public readonly role: Role,\n  ) {}\n}\n\n/**\n * Emitted when user switches active role.\n * Consumed by: Notification (adjust notification preferences), Analytics\n */\nclass ActiveRoleChangedEvent {\n  constructor(\n    public readonly userId: string,\n    public readonly newActiveRole: Role,\n  ) {}\n}\n\n/**\n * Emitted when email verified.\n * Consumed by: Notification (send welcome email), Verification (mark email verification complete)\n */\nclass EmailVerifiedEvent {\n  constructor(public readonly userId: string, public readonly email: string) {}\n}\n\n/**\n * Emitted when phone verified.\n * Consumed by: Notification (send welcome SMS), Verification (mark phone verification complete)\n */\nclass PhoneVerifiedEvent {\n  constructor(\n    public readonly userId: string,\n    public readonly phoneNumber: string,\n  ) {}\n}\n```\n\n### Event Handlers (React to other module events)\n\n```typescript\n/**\n * Listens to ProviderCreatedEvent and adds PROVIDER role to user.\n * Part of provider registration flow.\n */\nclass OnProviderCreatedAddRoleHandler {\n  /**\n   * @listens ProviderCreatedEvent\n   * Calls AddRoleCommandHandler with role=PROVIDER\n   */\n  handle(event: ProviderCreatedEvent): Promise<void>;\n}\n\n/**\n * Listens to ClientCreatedEvent and adds CLIENT role to user.\n * Part of client registration flow.\n */\nclass OnClientCreatedAddRoleHandler {\n  /**\n   * @listens ClientCreatedEvent\n   * Calls AddRoleCommandHandler with role=CLIENT\n   */\n  handle(event: ClientCreatedEvent): Promise<void>;\n}\n```
````
