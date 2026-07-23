# Verification — DDD & EIP Analysis

## 1. Current Responsibility

**Module has no service** — only GraphQL entities and Prisma models.

- Likely handles identity verification (phone, email, BVN, etc.) via external service.
- Prisma model `Verification` (in prisma/model/verification.prisma) stores verification records.

**Files**: `verification.module.ts`, `entities/`.

## 2. Bounded Context Assessment

**This should be part of Users bounded context** or a separate "Identity & Trust" context.

- Verification is a **supporting process** for user onboarding (phone/email verification before posting errands).
- If complex (BVN, KYC, background checks), could be separate bounded context.

**Verdict**: If verification is simple (phone/email OTPs), merge into Users module. If complex (KYC, background checks), keep as separate "Verification" context.

## 3. Domain Model Audit

**No service layer** — verification logic might be in resolver or missing entirely.

- If verification is delegated to external service (Termii for SMS OTP, Resend for email OTP), this is fine as infrastructure.

**Potential aggregates**:

- `Verification` (aggregate root): `{ userId, type, status, expiresAt }`.
- Methods: `Verification.verify(code)`, `Verification.expire()`, `Verification.resend()`.

## 4. Layering Violations

**Cannot assess** — no service file to review.

- If verification logic is in resolver, that's a layering violation (business logic in presentation layer).

## 5. Repository Pattern Gap

**Current state**: Likely no repository (if verification is delegated to external service).

**Proposed**:

```
domain/
  IVerificationRepository (interface)
    - findByUserId(userId): Verification[]
    - save(verification): void
```

## 6. EIP Opportunities

**Command/Event patterns**:

1. **PhoneVerified event**:
   - When user verifies phone, emit event.
   - Listeners:
     - Users module updates `phoneVerified` flag.
     - Notification sends "phone verified" confirmation.
     - Client module marks verification requirement as completed.

2. **EmailVerified event**:
   - When user verifies email, emit event.
   - Listeners: Same as PhoneVerified.

**Dead Letter / Retry**:

- If OTP SMS fails (Termii timeout), retry 3x.
- If OTP email fails (Resend timeout), retry 3x.

## 7. Cross-Cutting Concerns

**Not applicable** — no service to review.

## 8. GraphQL-Specific Notes

**Authorization**:

- Verification mutations should be public (user not logged in yet) or require minimal auth (user ID only).

## 9. Target Structure

```
src/verification/
  domain/
    entities/
      Verification.ts               # Aggregate root with verify(code), expire()
    value-objects/
      VerificationType.ts           # PHONE | EMAIL | BVN
      VerificationStatus.ts         # PENDING | VERIFIED | EXPIRED
    repositories/
      IVerificationRepository.ts
    events/
      PhoneVerified.ts
      EmailVerified.ts

  application/
    commands/
      SendVerificationCode/
        SendVerificationCodeCommand.ts
        SendVerificationCodeHandler.ts  # Send OTP via Termii or Resend
      VerifyCode/
        VerifyCodeCommand.ts
        VerifyCodeHandler.ts        # Validate OTP, emit event

  infrastructure/
    repositories/
      PrismaVerificationRepository.ts
    adapters/
      TermiiOtpAdapter.ts           # Sends SMS OTPs
      ResendOtpAdapter.ts           # Sends email OTPs

  presentation/
    resolvers/
      VerificationResolver.ts
```

## Persistence Model (Derived from Domain)

```prisma
model ProviderVerification {
  id String @id @map("_id")
  identifier String
  value String
  providerId String
  type VerificationType
  status VerificationStatus
  metadata Json?
  verifiedAt DateTime?
  expiresAt DateTime?
  createdAt DateTime

  @@unique([providerId, type]) // backs: DuplicateVerificationTypeError
  @@index([status, expiresAt]) // serves: expiry jobs/read models
}
```

`metadata` is embedded. Reference fields are scalar IDs only: `providerId`. Cleanup owner: `ProviderDeletedPolicyHandler` archives verification records or deletes pending records through `IVerificationRepository`; verified history should be retained for audit. `id` serves `findById`, and the unique provider/type pair serves `findByProviderAndType` while enforcing one current verification of each type per provider.

---

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Verification is a supporting feature — refactoring won't break core flows (unless verification is required to post errands).

**Priority**: **PHASE 2 (parallel with Users)**
**Rationale**:

1. Verification is tightly coupled to Users (user onboarding) — refactor together.
2. If verification is missing/incomplete, implement before launch (security risk).

**Migration steps**:

1. **Implement Verification service** if missing (send OTP, verify OTP).
2. **Extract Verification aggregate** with `verify(code)`, `expire()` methods.
3. **Introduce IVerificationRepository** and `PrismaVerificationRepository`.
4. **Emit events**: `PhoneVerified`, `EmailVerified`.
5. **Integrate with Users module** (update `phoneVerified`, `emailVerified` flags).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Verification aggregate for provider verification lifecycle.
 * Maps to ProviderVerification fields: id, identifier, value, providerId, type, status, metadata, verifiedAt, expiresAt, createdAt.
 */
class VerificationId extends EntityId {
  /**
   * Private constructor. Use VerificationId.new() or VerificationId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new VerificationId.
   */
  static new(): VerificationId;

  /**
   * Rehydrates VerificationId from persisted value.
   */
  static from(value: string): VerificationId;
}

/**
 * Verification aggregate for provider verification lifecycle.
 */
class ProviderVerificationAggregate extends AggregateRoot<VerificationId> {
  constructor(
    public readonly id: VerificationId,
    public readonly identifier: string,
    private value: string,
    public readonly providerId: ProviderId,
    private type: VerificationType,
    private status: VerificationStatus,
    private metadata: Record<string, unknown> | null,
    private verifiedAt: Date | null,
    private expiresAt: Date | null,
    public readonly createdAt: Date,
  );

  /**
   * Creates a new provider verification aggregate.
   */
  static create(
    identifier: string,
    value: string,
    providerId: ProviderId,
    type: VerificationType,
    metadata: Record<string, unknown> | null,
    expiresAt: Date | null,
    createdAt: Date,
  ): ProviderVerificationAggregate;

  /**
   * Reconstitutes provider verification aggregate from persistence.
   */
  static reconstitute(
    id: VerificationId,
    identifier: string,
    value: string,
    providerId: ProviderId,
    type: VerificationType,
    status: VerificationStatus,
    metadata: Record<string, unknown> | null,
    verifiedAt: Date | null,
    expiresAt: Date | null,
    createdAt: Date,
  ): ProviderVerificationAggregate;

  /**
   * Verifies submitted code/value and transitions status to APPROVED.
   */
  approve(verifiedAt: Date): void;

  /**
   * Rejects verification and transitions status to REJECTED.
   */
  reject(): void;

  /**
   * Marks verification as expired.
   */
  expire(expiredAt: Date): void;
}
```

### Repository Interface

```typescript
/**
 * Persistence contract for ProviderVerification lifecycle.
 */
interface IVerificationRepository {
  /**
   * Finds verification by ProviderVerification.id.
   */
  findById(id: VerificationId): Promise<ProviderVerificationAggregate | null>;

  /**
   * Finds verification by providerId and type.
   */
  findByProviderAndType(
    providerId: ProviderId,
    type: VerificationType,
  ): Promise<ProviderVerificationAggregate | null>;

  /**
   * Saves verification status changes.
   */
  save(verification: ProviderVerificationAggregate): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Sends verification challenge or code to selected channel/provider.
 */
class SendVerificationCodeCommandHandler {
  /**
   * Creates or refreshes pending verification entry and emits VerificationCodeSentEvent.
   */
  execute(command: SendVerificationCodeCommand): Promise<VerificationId>;
}

interface SendVerificationCodeCommand {
  providerId: ProviderId;
  type: VerificationType;
  identifier: string;
}

/**
 * Verifies submitted challenge response.
 */
class VerifyCodeCommandHandler {
  /**
   * Validates verification value and updates status.
   */
  execute(command: VerifyCodeCommand): Promise<void>;
}

interface VerifyCodeCommand {
  verificationId: VerificationId;
  submittedValue: string;
}
```

### Domain Events

```typescript
/**
 * Emitted when verification challenge is sent.
 */
class VerificationCodeSentEvent {
  constructor(
    public readonly verificationId: VerificationId,
    public readonly providerId: ProviderId,
    public readonly type: VerificationType,
  );
}

/**
 * Emitted when verification is approved.
 */
class ProviderVerificationApprovedEvent {
  constructor(
    public readonly verificationId: VerificationId,
    public readonly providerId: ProviderId,
    public readonly type: VerificationType,
  );
}
```
