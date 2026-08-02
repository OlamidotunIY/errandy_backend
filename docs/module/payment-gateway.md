# Module: payment-gateway

## Folder placement

```
src/modules/payment-gateway/
├── domain/
│   ├── entities/
│   │   └── payment-transaction.entity.ts
│   ├── repositories/
│   │   └── payment-transaction.repository.interface.ts
│   ├── events/
│   │   ├── payment-succeeded.event.ts
│   │   ├── payment-failed.event.ts
│   │   └── payment-refunded.event.ts
│   └── errors/
│       ├── payment-transaction-not-found.error.ts
│       ├── gateway-timeout.error.ts
│       └── invalid-payment-method.error.ts
├── application/
│   ├── commands/
│   │   ├── initiate-charge/
│   │   └── refund-payment/
│   ├── event-handlers/
│   │   └── on-escrow-refunded.handler.ts   (→ dispatches RefundPaymentCommand)
│   ├── jobs/
│   │   └── gateway-reconciliation.job.ts
│   └── queries/
│       ├── get-payment-transaction-by-id/
│       └── find-by-gateway-reference/
├── infrastructure/
│   ├── adapters/
│   │   ├── payment-gateway.adapter.ts
│   │   └── webhook-verifier.adapter.ts
│   ├── mappers/
│   │   └── payment-transaction.mapper.ts
│   └── repositories/
│       └── payment-transaction.repository.ts
└── payment-gateway.module.ts
```

## Prisma schema

`purposeId` deliberately has no accompanying `purposeType` — see the main doc's Decision Log; relevance is determined by whether a matching `AcceptApplicationProgress` (or equivalent) row exists in the calling module, not by a type tag here.

```prisma
model PaymentTransaction {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  clientId        String   @db.ObjectId   // Party — plain scalar
  purposeId       String   @db.ObjectId   // an applicationId, or an errand id for direct bookings
  amount          Money
  status          String   @default("PENDING")   // PENDING | SUCCEEDED | FAILED | REFUNDED
  gatewayReference String?
  method          String?
  failureReason   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([purposeId])
  @@index([gatewayReference])
}
```

## Domain entity methods

**`PaymentTransaction`**
- `initiate(clientId, purposeId, amount, paymentMethodId)` — starts `PENDING`
- `markSucceeded(gatewayReference)` → `SUCCEEDED`
- `markFailed(reason)` → `FAILED`
- `refund()` → `REFUNDED` (only valid from `SUCCEEDED`)

## Repository interface

```typescript
abstract class IPaymentTransactionRepository {
  abstract save(transaction: PaymentTransaction): Promise<void>;
  abstract findById(id: string): Promise<PaymentTransaction | null>;
  abstract findByGatewayReference(reference: string): Promise<PaymentTransaction | null>;
  abstract findByPurposeId(purposeId: string): Promise<PaymentTransaction | null>;
}
```

## DTOs

```typescript
// commands/initiate-charge/initiate-charge.request.dto.ts
interface InitiateChargeRequestDto {
  clientId: string;
  purposeId: string;
  amount: { amountMinorUnits: number; currency: string };
  paymentMethodId: string;
  correlationId: string;   // always passed in by the caller — this module never generates its own
}
interface InitiateChargeResponseDto {
  paymentTransactionId: string;
}

// commands/refund-payment/refund-payment.request.dto.ts
interface RefundPaymentRequestDto {
  paymentTransactionId: string;
  correlationId: string;
}

// queries/get-payment-transaction-by-id/get-payment-transaction-by-id.response.dto.ts
interface PaymentTransactionResponseDto {
  id: string;
  clientId: string;
  purposeId: string;
  amount: { amountMinorUnits: number; currency: string };
  status: string;
  gatewayReference: string | null;
  method: string | null;
  failureReason: string | null;
  createdAt: string;
}
```

## Open items

None new.
