# Auth — DDD & EIP Analysis

## 1. Current Responsibility

**Minimal authentication orchestration**: The Auth module is nearly empty, containing only:

- `handleSignUpComplete(email)` method: Fetches newly created user and emits `user.created` event for downstream systems (Paystack customer creation, wallet initialization).
- Auth guards (`GqlAuthGuard` in `guard/` folder).
- DTOs (`login.dto.ts`, `register.dto.ts`).
- Entities (likely auth-related types like `Session`, `Account`).

**Actual authentication logic lives elsewhere**:

- User creation/sign-up is handled by **better-auth** library (external, not in this module).
- Session management is in `Session` Prisma model (not managed by AuthService).

**Files**: `auth.service.ts` (~30 lines), `auth.module.ts`, `auth.hook.ts`, `guard/`, `decorator/`.

## 2. Bounded Context Assessment

**This is NOT a real bounded context** — it's a **thin adapter** over better-auth library and an event bridge.

**Overlaps**:

- **Users**: User creation is triggered by auth, but user profile management is in Users module.
- **Payment-Gateway**: `user.created` event triggers Paystack customer creation (handled by Payment-Gateway module).
- **Wallet**: `user.created` event should trigger wallet creation, but Wallet module is a stub (logic is in Escrow/Payment-Gateway).

**Verdict**: Auth is a **cross-cutting infrastructure concern**, not a domain. It should provide authentication primitives (guards, decorators) but NOT contain business logic.

## 3. Domain Model Audit

**Anemic models**:

- `User`, `Session`, `Account` (Prisma models) are used by better-auth library, but Auth module doesn't interact with them directly.
- No domain behavior in Auth module (e.g., no `UserAccount.verifyPassword()`, `Session.isExpired()`).

**Aggregate boundaries**:

- If Auth were a real domain, `User` would be the aggregate root with:
  - `Account` (child entity for OAuth/email providers).
  - `Session` (child entity for active sessions).
  - `TwoFactor` (child entity for 2FA codes).
- However, better-auth manages this lifecycle externally, so Auth module is passive.

**Invariants currently unenforced**:

- None in Auth module itself (better-auth handles validation).
- Downstream: `user.created` event has no validation (e.g., what if email is invalid format?).

## 4. Layering Violations

**Business logic in infrastructure**:

- `handleSignUpComplete` (line 16) emits `user.created` event with user data — this is an **application service concern** (orchestrating post-sign-up workflows), not an auth concern.
- Better-auth library is tightly coupled to Prisma schema (`User`, `Session`, `Account` models) — changing auth library requires Prisma schema changes (vendor lock-in).

**Event emission**:

- Uses NestJS `EventEmitter2` (line 8), which is fine, but event payload is untyped (line 23: object literal).
- No event class (`UserCreatedEvent`), making it hard to track what data is passed to listeners.

## 5. Repository Pattern Gap

**Current state**: Auth module does NOT access database directly (better-auth does via Prisma).

**No repository needed** for Auth module itself. However:

- If Auth module grows to handle user registration logic (instead of better-auth), it would need `IUserRepository`.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **UserRegistered event**:
   - Current: `handleSignUpComplete` is called after better-auth creates user (unclear how — probably a webhook or hook).
   - Proposed: `UserRegistered` domain event (typed class) emitted by Auth module.
   - Listeners:
     - Payment-Gateway creates Paystack customer.
     - Wallet creates wallet.
     - Notification sends welcome email.
     - Users module completes user profile (set onboarding progress).

2. **UserLoggedIn event**:
   - Not currently emitted, but could be useful for:
     - Tracking last login timestamp.
     - Sending "login from new device" alerts.
     - Analytics.

**Message Router**:

- `user.created` event is broadcast to all listeners (Payment-Gateway, Notification).
- This is implicit routing (all listeners get the event).
- If different user types (client vs. provider) need different workflows, use **content-based router**:
  - Emit `ClientRegistered` or `ProviderRegistered` based on user role.

**Dead Letter / Retry**:

- If `user.created` event listener fails (e.g., Paystack API timeout during customer creation), event is lost (NestJS EventEmitter is in-memory, no persistence).
- Recommendation: Use BullMQ or Redis Streams for event persistence + retry.

## 7. Cross-Cutting Concerns

**Validation**:

- DTOs (`LoginDto`, `RegisterDto`) likely have class-validator rules, but Auth module doesn't use them (better-auth handles validation).

**Transactions**:

- Not applicable (Auth module doesn't write to DB).

**Error handling**:

- `handleSignUpComplete` throws generic `Error` (line 20: `'User not found after sign up'`).
- This error should never happen (better-auth guarantees user exists after sign-up), so it's a defensive check.
- If it does happen, it indicates a critical system failure (race condition or better-auth bug).

## 8. GraphQL-Specific Notes

**No GraphQL resolver in Auth module**:

- Authentication is handled by better-auth (likely via REST endpoints or separate GraphQL mutations).
- Auth guards (`GqlAuthGuard`) are used in other modules' resolvers (e.g., `@UseGuards(GqlAuthGuard)`).

**Authorization**:

- `GqlAuthGuard` extracts current user from request context.
- `@CurrentUser()` decorator (in `decorator/`) injects user into resolver methods.
- No role-based access control (RBAC) in Auth module (roles are checked in individual resolvers).

## 9. Target Structure

**Keep Auth as thin infrastructure layer**:

```
src/auth/
  infrastructure/
    better-auth/
      BetterAuthAdapter.ts          # Wraps better-auth library
      BetterAuthConfig.ts           # Configuration
    guards/
      GqlAuthGuard.ts               # GraphQL auth guard
      JwtAuthGuard.ts               # REST auth guard (if needed)
    decorators/
      CurrentUser.ts                # Extract user from context

  application/
    events/
      UserRegistered.ts             # Typed event class
      UserLoggedIn.ts
    event-handlers/
      OnUserRegisteredEmitEvent.ts  # Bridge: better-auth hook → NestJS event

  presentation/
    # No resolver (auth is handled by better-auth)
```

**Alternative: Move to Users module**:

- If Auth module only contains guards/decorators, merge them into a `src/common/auth/` folder.
- User registration events can be emitted directly from Users module.

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Auth module is minimal and doesn't own business logic.
- Refactoring won't break existing flows (better-auth is independent).

**Priority**: **PHASE 3 (last)**
**Rationale**:

1. Auth module is already well-isolated (thin layer over better-auth).
2. No urgent DDD violations (it's not a domain module).
3. Focus on core domain modules first (Errands, Escrow, Wallet).
4. When refactoring other modules, ensure they emit typed events (`UserCreated`, not raw objects) — then clean up Auth module's event bridge in Phase 3.

**Migration steps**:

1. **Create typed event classes**: `UserRegisteredEvent`, `UserLoggedInEvent`.
2. **Update `handleSignUpComplete`** to emit typed event instead of object literal.
3. **Move auth guards/decorators** to `src/common/auth/` if not domain-specific.
4. **Add event persistence**: Replace NestJS EventEmitter with BullMQ for `user.created` events (allows retry on listener failure).
5. **Document better-auth integration** (how sign-up/login flows work, where hooks are configured).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Auth identity snapshot used by the application layer.
 * Backed by User fields: id, email, phoneNumber, emailVerified, phoneNumberVerified, createdAt.
 */
class AuthIdentity {
  constructor(
    public readonly id: string,
    public readonly email: string | null,
    public readonly phoneNumber: string | null,
    public readonly emailVerified: boolean,
    public readonly phoneNumberVerified: boolean | null,
    public readonly createdAt: Date,
  );

  /**
   * Returns whether at least one login identifier exists.
   */
  hasLoginIdentifier(): boolean;
}

/**
 * Session snapshot mapped from Session fields: id, token, expiresAt, userId.
 */
class AuthSession {
  constructor(
    public readonly id: string,
    public readonly token: string,
    public readonly expiresAt: Date,
    public readonly userId: string,
  );

  /**
   * Returns true when session is expired at read time.
   */
  isExpired(now: Date): boolean;
}
```

### Repository Interface

```typescript
/**
 * Repository contract for auth-adjacent persisted records.
 */
interface IAuthRepository {
  /**
   * Reads auth identity by User.id.
   */
  findIdentityByUserId(userId: string): Promise<AuthIdentity | null>;

  /**
   * Reads auth identity by User.email (unique).
   */
  findIdentityByEmail(email: string): Promise<AuthIdentity | null>;

  /**
   * Reads active session by Session.token.
   */
  findSessionByToken(token: string): Promise<AuthSession | null>;

  /**
   * Creates/updates Verification row with identifier, value, expiresAt.
   */
  saveVerification(
    identifier: string,
    value: string,
    expiresAt: Date,
  ): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Handles post-registration bridge from better-auth into internal event pipeline.
 */
class HandleSignUpCompleteCommandHandler {
  /**
   * Loads user by id/email, validates identity existence, then emits UserRegisteredEvent.
   */
  execute(command: HandleSignUpCompleteCommand): Promise<void>;
}

interface HandleSignUpCompleteCommand {
  userId?: string;
  email?: string;
}

/**
 * Handles successful login hook and emits typed login event.
 */
class HandleLoginSucceededCommandHandler {
  /**
   * Emits UserLoggedInEvent with userId and Session.id for auditing.
   */
  execute(command: HandleLoginSucceededCommand): Promise<void>;
}

interface HandleLoginSucceededCommand {
  userId: string;
  sessionId: string;
}
```

### Domain Events

```typescript
/**
 * Emitted after user registration completes.
 */
class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string | null,
    public readonly phoneNumber: string | null,
    public readonly createdAt: Date,
  );
}

/**
 * Emitted after successful login session creation.
 */
class UserLoggedInEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly occurredAt: Date,
  );
}
```
