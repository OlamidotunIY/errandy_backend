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

## Persistence Model (Derived from Domain)

```prisma
model User {
  id String @id @map("_id")
  name String?
  email String?
  phoneNumber String?
  emailVerified Boolean
  phoneVerified Boolean
  image String?
  roles String[]
  activeRole String?
  activeAddressId String?
  onboardingProgress Json
  createdAt DateTime
  updatedAt DateTime

  @@unique([email]) // backs: DuplicateEmailError
  @@unique([phoneNumber]) // backs: DuplicatePhoneNumberError
  @@index([activeAddressId]) // serves: active address cleanup checks
}
```

`Email`, `PhoneNumber`, and `OnboardingProgress` are embedded value objects. `activeAddressId` is a scalar reference to the Address module's `UserAddress.id`; User does not embed or mutate address rows. Cleanup owner: `DeleteUserAddressCommandHandler` must clear or replace `activeAddressId` through Users before removing an address; `UserDeletedPolicyHandler` coordinates soft-delete with Provider, Client, Wallet, Chat, Rating, Address, Auth, and Payment-Gateway references. `id` serves `findById`, unique `email` serves `findByEmail`, and the phone unique backs the same platform identity invariant.

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

```typescript
/**
 * User aggregate root representing a platform user (shared kernel).
 * Core invariants:
 * - User must have at least one verified contact (email OR phone)
 * - activeAddressId must reference one of user's own addresses
 * - Cannot switch to PROVIDER role without Provider profile
 * - Cannot switch to CLIENT role without Client profile
 * - Email and phone must be unique across platform
 */
class UserId extends EntityId {
  /**
   * Private constructor. Use UserId.new() or UserId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new UserId.
   */
  static new(): UserId;

  /**
   * Rehydrates UserId from persisted value.
   */
  static from(value: string): UserId;
}

/**
 * Address identifier used across address-bearing modules.
 */
class AddressId extends EntityId {
  /**
   * Private constructor. Use AddressId.new() or AddressId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new AddressId.
   */
  static new(): AddressId;

  /**
   * Rehydrates AddressId from persisted value.
   */
  static from(value: string): AddressId;
}

/**
 * User aggregate root representing a platform user (shared kernel).
 */
class User extends AggregateRoot<UserId> {
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
    public readonly id: UserId,
    private name: string | null,
    private email: Email | null,
    private phoneNumber: PhoneNumber | null,
    private emailVerified: boolean,
    private phoneVerified: boolean,
    private image: string | null,
    private roles: Role[],
    private activeRole: Role | null,
    private activeAddressId: AddressId | null,
    private onboardingProgress: OnboardingProgress,
    private readonly addresses: UserAddress[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Creates a new user aggregate.
   */
  static create(
    email?: string,
    phoneNumber?: string,
    name?: string,
  ): User;

  /**
   * Reconstitutes user aggregate from persistence.
   */
  static reconstitute(
    id: UserId,
    name: string | null,
    email: Email | null,
    phoneNumber: PhoneNumber | null,
    emailVerified: boolean,
    phoneVerified: boolean,
    image: string | null,
    roles: Role[],
    activeRole: Role | null,
    activeAddressId: AddressId | null,
    onboardingProgress: OnboardingProgress,
    addresses: UserAddress[],
    createdAt: Date,
    updatedAt: Date,
  ): User;


  /**
   * Updates user profile (name, image, phone, email).
   * Image upload happens in infrastructure layer - this just stores URL.
   * @param updates Profile updates
   * @throws InvalidEmailError when email format invalid
   * @throws InvalidPhoneNumberError when phone format invalid
   * @emits UserProfileUpdatedEvent
   */
  updateProfile(updates: Partial<UserProfileUpdates>): void;

  /**
   * Adds new address to user's address collection.
   * First address added becomes active address automatically.
   * @param street Street address
   * @param city City
   * @param state State
   * @param country Country
   * @param placeId Optional Google Places ID
   * @param coordinates Optional GPS coordinates
   * @returns New UserAddress ID
   * @emits AddressAddedEvent
   */
  addAddress(
    street: string,
    city: string,
    state: string,
    country: string,
    placeId?: string,
    coordinates?: [number, number],
  ): AddressId;

  /**
   * Deletes address from user's collection.
   * CRITICAL: Sets activeAddressId to null if deleting active address.
   * @param addressId Address ID to delete
   * @throws AddressNotFoundError when address doesn't belong to user
   * @emits AddressDeletedEvent
   */
  deleteAddress(addressId: AddressId): void;

  /**
   * Sets active address (used for location-based queries).
   * @param addressId Address ID to set as active
   * @throws AddressNotFoundError when address doesn't belong to user
   * @emits ActiveAddressChangedEvent
   */
  setActiveAddress(addressId: AddressId): void;

  /**
   * Adds role to user (called when Provider or Client profile created).
   * @param role Role to add (PROVIDER or CLIENT)
   * @throws RoleAlreadyExistsError when user already has role
   * @emits RoleAddedEvent
   */
  addRole(role: Role): void;

  /**
   * Switches active role (user toggles between CLIENT and PROVIDER modes).
   * @param role Role to switch to
   * @throws RoleNotAssignedError when user doesn't have this role
   * @emits ActiveRoleChangedEvent
   */
  switchRole(role: Role): void;

  /**
   * Marks email as verified.
   * @emits EmailVerifiedEvent
   */
  verifyEmail(): void;

  /**
   * Marks phone as verified.
   * @emits PhoneVerifiedEvent
   */
  verifyPhone(): void;

  /**
   * Updates onboarding progress (for providers).
   * Tracks completion of profile, address, bio, skills, etc.
   * @param field Onboarding field to mark complete
   */
  markOnboardingComplete(field: OnboardingField): void;

  /**
   * Checks if user has at least one verified contact method.
   */
  hasVerifiedContact(): boolean;

  /**
   * Returns active address or null.
   */
  getActiveAddress(): UserAddress | null;
}
```

### Repository Interface

```typescript
/**
 * Persistence contract for User aggregate.
 */
interface IUserRepository {
  /**
   * Finds user by User.id.
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Finds user by unique User.email.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Finds user by User.phoneNumber.
   */
  findByPhoneNumber(phoneNumber: string): Promise<User | null>;

  /**
   * Persists core User fields and role/address updates.
   */
  save(user: User): Promise<void>;

  /**
   * Returns UserAddress records by UserAddress.userId.
   */
  findAddresses(userId: UserId): Promise<UserAddress[]>;
}
```

### Application Layer

```typescript
/**
 * Updates user profile details.
 */
class UpdateUserProfileCommandHandler {
  /**
   * Updates User fields: name, email, phoneNumber, image, onboardingProgress.
   * @emits UserProfileUpdatedEvent
   */
  execute(command: UpdateUserProfileCommand): Promise<void>;
}

interface UpdateUserProfileCommand {
  userId: UserId;
  name?: string;
  email?: string;
  phoneNumber?: string;
  image?: string;
  onboardingProgress?: OnboardingProgress;
}

/**
 * Adds an address for a user.
 */
class AddAddressCommandHandler {
  /**
   * Inserts UserAddress row and may update User.activeAddressId.
   * @emits AddressAddedEvent
   */
  execute(command: AddAddressCommand): Promise<AddressId>;
}

interface AddAddressCommand {
  userId: UserId;
  label: string;
  address: string;
  location: { type: 'Point'; coordinates: [number, number] };
}

/**
 * Deletes user address safely.
 */
class DeleteAddressCommandHandler {
  /**
   * Deletes UserAddress and nullifies User.activeAddressId when it references deleted address.
   * @emits AddressDeletedEvent
   */
  execute(command: DeleteAddressCommand): Promise<void>;
}

interface DeleteAddressCommand {
  userId: UserId;
  addressId: AddressId;
}
```

### Domain Events

```typescript
/**
 * Emitted after user profile update.
 */
class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: UserId,
    public readonly updatedFields: Array<"name" | "email" | "phoneNumber" | "image" | "onboardingProgress">,
  );
}

/**
 * Emitted when user address is added.
 */
class AddressAddedEvent {
  constructor(
    public readonly userId: UserId,
    public readonly addressId: AddressId,
  );
}

/**
 * Emitted when user address is deleted.
 */
class AddressDeletedEvent {
  constructor(
    public readonly userId: UserId,
    public readonly addressId: AddressId,
    public readonly clearedActiveAddress: boolean,
  );
}
```
