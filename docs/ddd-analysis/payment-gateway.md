# Payment-Gateway — DDD & EIP Analysis

## 1. Current Responsibility

Manages payment method storage (card tokenization) via Paystack:

- **Payment method retrieval**: `getPaymentMethods` (line 14-27) fetches saved cards for a client.
- **Tokenization flow**:
  - `initializeAddPaymentMethod` (line 29-71): Starts 50 Naira verification charge, returns Paystack checkout URL.
  - `verifyAndSavePaymentMethod` (line 73-149+): Verifies transaction, saves authorization code (token), refunds 50 Naira.
- **Paystack integration**: Uses `PaymentGatewayFactory` (line 11) to get provider-specific gateway (abstraction for multi-gateway support).

**Files**: `payment-gateway.service.ts` (~150+ lines), `payment-gateway.resolver.ts`, `payment-gateway.module.ts`, `payment-gateway.factory.ts`, `providers/paystack.provider.ts`.

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- Payment-Gateway is a **technical adapter** for Paystack API — it has no domain logic.
- Payment method storage is a **supporting concern** for Escrow (funding) and Wallet (deposits).

**Overlaps**:

- **Client**: Payment methods belong to clients (`PaymentMethod.userId → Client.id`).
- **Escrow**: Escrow uses payment methods to fund jobs (charge card via authorization code).
- **Wallet**: Wallet could use payment methods to top up balance (not implemented yet).

**Verdict**: Payment-Gateway is an **infrastructure layer** (Ports & Adapters outer layer). Should be renamed to `infrastructure/payment/` or `common/payment/`.

## 3. Domain Model Audit

**No domain model** — Payment-Gateway is purely infrastructure.

- `PaymentMethod` (Prisma model) is a persistence model, not a domain entity:
  - Stores tokenization metadata: `providerRef` (authorization_code), `cardBrand`, `last4`, `expMonth`, `expYear`.
  - No behavior: No `PaymentMethod.charge()`, `PaymentMethod.expire()` methods.

**Invariants (if PaymentMethod were a domain entity)**:

1. **Expiry validation**: Card expiry should be checked before charging (line 126: `expMonth` and `expYear` stored, but not validated).
2. **Uniqueness**: Only one payment method per card per user (line 104-112: checks for duplicates, but logic is in service, not domain).
3. **Default payment method**: If first card, set as default (line 139-146) — this is domain logic, should be in aggregate.

## 4. Layering Violations

**Business logic in service**:

- `verifyAndSavePaymentMethod` (line 73-149+) orchestrates:
  1. Verify Paystack transaction (infrastructure).
  2. Check card reusability (business rule, line 97-99).
  3. Deduplicate existing cards (business logic, line 104-112).
  4. Create PaymentMethod (persistence).
  5. Set default if first card (business logic, line 139-146).
  6. Refund 50 Naira (infrastructure, line 149+).

  This is a **use case** (command handler), not a domain service. Should be `AddPaymentMethodCommandHandler`.

**Infrastructure in service**:

- `gateway.initializeTransaction` (line 59), `gateway.verifyTransaction` (line 90), `gateway.refundTransaction` (line 149+) — direct infrastructure calls in service layer.

**Persistence leaking**:

- Direct Prisma calls throughout (`this.prisma.client.*`, `this.prisma.paymentMethod.*`).
- No repository abstraction.

**Event emission missing**:

- When payment method is added, should emit `PaymentMethodAdded` event:
  - Listeners:
    - Client module updates dashboard requirements (payment method requirement completed).
    - Notification sends "card added successfully" push notification.
- Current: No events emitted (uses `globalEventEmitter` elsewhere, but not here).

## 5. Repository Pattern Gap

**Current state**: No repository. Direct Prisma usage.

**Proposed**:

```
domain/
  IPaymentMethodRepository (interface)
    - findById(id): PaymentMethod | null
    - findByClientId(clientId): PaymentMethod[]
    - save(paymentMethod): void
infrastructure/
  PrismaPaymentMethodRepository (implementation)
```

**Consolidation**: All `prisma.paymentMethod.*` calls move to repository.

## 6. EIP Opportunities

**Command/Event patterns**:

1. **PaymentMethodAdded event**:
   - When card is saved, emit event.
   - Listeners:
     - Client module marks payment method requirement as completed.
     - Notification sends "card added" push notification.
     - Analytics tracks conversion (user onboarding).

2. **PaymentMethodRemoved event**:
   - When user deletes card, emit event.
   - Listeners:
     - If last card, Client module marks payment method requirement as incomplete.

**Adapter Pattern** (already implemented):

- `PaymentGatewayFactory` (line 11) returns provider-specific gateway (Paystack, Stripe, Flutterwave, etc.).
- This is correct — allows switching payment providers without changing service code.

**Dead Letter / Retry**:

- `initializeTransaction` (line 59) can fail (Paystack API timeout).
  - No retry — user sees error and must retry manually.
  - Recommendation: Queue in BullMQ, retry 3x.
- `refundTransaction` (line 149+) can fail after card is saved.
  - If refund fails, user is charged 50 Naira without refund — critical bug.
  - Recommendation: Queue refund as separate job, retry until success, alert ops if fails.

**Saga Pattern**:

- `verifyAndSavePaymentMethod` is a mini-saga (multi-step workflow):
  1. Verify transaction.
  2. Save payment method.
  3. Refund 50 Naira.

  If step 3 fails, need compensating transaction (manual refund). Should be a saga with compensation logic.

## 7. Cross-Cutting Concerns

**Validation**:

- No validation of client profile existence before initializing transaction (line 29-48: checks, but throws generic error).
- No validation of card expiry (line 126-127: stores expMonth/expYear, but doesn't check if expired).

**Transactions**:

- `verifyAndSavePaymentMethod` creates PaymentMethod, then updates it to set default (line 141-144) — two separate Prisma calls, no transaction.
- Race condition: If two cards are added concurrently, both could be set as default.

**Error handling**:

- Throws `BadRequestException` (line 44, line 82, line 97-99) — HTTP-specific exceptions in service layer.
- Should throw domain exceptions (`InvalidPaymentMethod`, `CardNotReusable`).

**Security**:

- Authorization code (line 120: `providerRef`) is sensitive — should be encrypted at rest.
- No PCI compliance considerations (Paystack handles card data, so server never sees PAN — good).

## 8. GraphQL-Specific Notes

**GraphQL mutations** (likely in resolver):

- `initializeAddPaymentMethod` mutation: Returns Paystack checkout URL (client redirects user to Paystack).
- `verifyAndSavePaymentMethod` mutation: Called after user completes payment on Paystack (callback URL).

**Authorization**:

- No auth checks in service (assumes resolver validates user can only manage their own payment methods).

## 9. Target Structure

```
src/infrastructure/payment/  # OR src/common/payment/
  application/
    commands/
      AddPaymentMethod/
        AddPaymentMethodCommand.ts
        AddPaymentMethodHandler.ts  # Use case: initialize → verify → save → refund → emit event
      RemovePaymentMethod/
        RemovePaymentMethodCommand.ts
        RemovePaymentMethodHandler.ts
    queries/
      GetPaymentMethods/
        GetPaymentMethodsQuery.ts
        GetPaymentMethodsHandler.ts
    events/
      PaymentMethodAdded.ts
      PaymentMethodRemoved.ts
    sagas/
      AddPaymentMethodSaga.ts       # Orchestrates: verify → save → refund (with compensation)

  domain/
    entities/
      PaymentMethod.ts              # Aggregate: isExpired(), setDefault()
    repositories/
      IPaymentMethodRepository.ts

  infrastructure/
    repositories/
      PrismaPaymentMethodRepository.ts
    gateways/
      IPaymentGateway.ts            # Interface (port)
      PaymentGatewayFactory.ts      # Factory
      providers/
        PaystackGateway.ts          # Adapter (implementation)
        StripeGateway.ts            # Future: Stripe support
    queues/
      RefundQueue.ts                # BullMQ queue for async refunds (retry on failure)

  presentation/
    resolvers/
      PaymentResolver.ts
    types/
      PaymentMethodType.ts
```

## 10. Migration Risk & Priority

**Risk**: **HIGH**

- Payment is critical infrastructure — bugs can cause financial loss (refund failures).
- Refactoring could break tokenization flow (users unable to add cards → can't post errands).

**Priority**: **PHASE 1 (parallel with Escrow/Wallet)**
**Rationale**:

1. Payment-Gateway is tightly coupled to Escrow (card charging) — refactor together.
2. Refund bug (line 149+: no retry if fails) is a critical financial risk — must be fixed.
3. Queueing refunds in BullMQ improves reliability.

**Migration steps**:

1. **Extract PaymentMethod aggregate** with `isExpired()`, `setDefault()` methods.
2. **Introduce IPaymentMethodRepository** and `PrismaPaymentMethodRepository`.
3. **Create AddPaymentMethodCommandHandler** (move orchestration out of service).
4. **Emit events**: `PaymentMethodAdded`, `PaymentMethodRemoved`.
5. **Queue refunds** in BullMQ (retry 3x on failure, alert ops if fails).
6. **Wrap tokenization flow in saga** with compensation logic (if save fails, don't refund).
7. **Add card expiry validation** (prevent charging expired cards).
8. **Encrypt authorization codes** at rest (PCI compliance).
9. **Add DataLoader** for payment methods (prevent N+1 if needed).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Payment method aggregate.
 * Maps to PaymentMethod fields: id, userId, provider, providerRef, type, cardBrand, last4, expMonth, expYear, isDefault, verified, createdAt.
 */
class PaymentMethodAggregate {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly provider: string,
    public readonly providerRef: string,
    public readonly type: string,
    public readonly cardBrand: string | null,
    public readonly last4: string | null,
    public readonly expMonth: number | null,
    public readonly expYear: number | null,
    private isDefault: boolean,
    private verified: boolean,
    public readonly createdAt: Date,
  );

  /**
   * Marks this method as default for owner userId.
   */
  setDefault(): void;

  /**
   * Marks method as verified once authorization succeeds.
   */
  markVerified(): void;

  /**
   * Checks card expiry from expMonth and expYear.
   */
  isExpired(now: Date): boolean;
}
```

### Repository Interface

```typescript
/**
 * Persistence contract for payment methods and provider customer mapping.
 */
interface IPaymentMethodRepository {
  /**
   * Finds payment method by PaymentMethod.id.
   */
  findById(id: string): Promise<PaymentMethodAggregate | null>;

  /**
   * Finds methods by PaymentMethod.userId.
   */
  findByUserId(userId: string): Promise<PaymentMethodAggregate[]>;

  /**
   * Finds default method for user (isDefault = true).
   */
  findDefaultByUserId(userId: string): Promise<PaymentMethodAggregate | null>;

  /**
   * Persists PaymentMethod updates.
   */
  save(method: PaymentMethodAggregate): Promise<void>;

  /**
   * Saves/updates PaystackCustomer mapping (customer_code, customer_id, userId).
   */
  savePaystackCustomer(
    customerCode: string,
    customerId: string,
    userId: string,
  ): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Orchestrates card authorization verification and persistence.
 */
class AddPaymentMethodCommandHandler {
  /**
   * Verifies provider reference, saves method, enqueues refund compensation if needed.
   */
  execute(command: AddPaymentMethodCommand): Promise<string>;
}

interface AddPaymentMethodCommand {
  userId: string;
  provider: 'paystack';
  authorizationCode: string;
  setAsDefault?: boolean;
}

/**
 * Removes payment method owned by user.
 */
class RemovePaymentMethodCommandHandler {
  /**
   * Deletes method and emits PaymentMethodRemovedEvent.
   */
  execute(command: RemovePaymentMethodCommand): Promise<void>;
}

interface RemovePaymentMethodCommand {
  paymentMethodId: string;
  userId: string;
}
```

### Domain Events

```typescript
/**
 * Emitted when payment method is successfully added and verified.
 */
class PaymentMethodAddedEvent {
  constructor(
    public readonly paymentMethodId: string,
    public readonly userId: string,
    public readonly provider: string,
    public readonly isDefault: boolean,
  );
}

/**
 * Emitted when payment method is removed.
 */
class PaymentMethodRemovedEvent {
  constructor(
    public readonly paymentMethodId: string,
    public readonly userId: string,
  );
}
```
