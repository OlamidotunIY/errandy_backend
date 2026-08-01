# Module: application

The most complex module in the system — covers both `BID` and `DIRECT_OFFER` origins, and owns the accept-flow's persisted progress tracking (see Decision Log #8/#9 in the main doc: no "Process Manager" class, just a progress entity + ordinary commands + a queue processor).

## Folder placement

```
src/modules/application/
├── domain/
│   ├── entities/
│   │   ├── application.entity.ts
│   │   └── accept-application-progress.entity.ts
│   ├── value-objects/
│   │   └── origin-type.vo.ts   (BID | DIRECT_OFFER)
│   ├── repositories/
│   │   ├── application.repository.interface.ts
│   │   └── accept-application-progress.repository.interface.ts
│   ├── events/
│   │   ├── application-submitted.event.ts
│   │   ├── application-accepted.event.ts
│   │   └── application-rejected.event.ts
│   └── errors/
│       ├── application-invariant.error.ts
│       ├── application-not-found.error.ts
│       └── duplicate-application.error.ts
├── application/
│   ├── commands/
│   │   ├── submit-application/
│   │   ├── request-application-acceptance/     (true entry point)
│   │   ├── accept-application/                 (resume step — only ever dispatched by the processor, never a controller)
│   │   ├── mark-application-acceptance-failed/
│   │   ├── reject-application/
│   │   └── reject-other-applications/          (internal, saga-issued only)
│   ├── event-handlers/
│   │   ├── on-payment-succeeded.handler.ts     (thin bridge — no business logic, just enqueues)
│   │   └── on-payment-failed.handler.ts
│   ├── processors/
│   │   └── accept-application-continue.processor.ts   (one processor, two job names)
│   ├── sagas/
│   │   └── reject-other-applications.saga.ts
│   ├── policies/
│   │   └── application-access.policy.ts   (derives allowed access from authenticated userId, never a client-claimed role)
│   └── queries/
│       ├── get-application/
│       ├── list-errand-applications/
│       ├── get-my-application/
│       ├── get-application-summary/
│       └── list-my-applications/
├── infrastructure/
│   ├── mappers/
│   │   └── application.mapper.ts
│   └── repositories/
│       ├── application.repository.ts
│       └── accept-application-progress.repository.ts
└── application.module.ts
```

## Prisma schema

`AcceptApplicationProgress` shares its PK with `Application` (same reasoning as `Person`/`Organization` sharing `Party`'s PK) — it's internal orchestration state for `Application`'s own transition to `ACCEPTED`, not a separate module's concern, so the shared-PK relation is legitimate here.

```prisma
model Application {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  errandId       String    @db.ObjectId
  applicantId    String    @db.ObjectId   // Party — plain scalar, cross-module reference
  originType     String    // BID | DIRECT_OFFER
  status         String    @default("PENDING")   // PENDING | ACCEPTED | REJECTED
  proposal       String
  proposedAmount Money
  acceptedAt     DateTime?
  rejectedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  acceptProgress AcceptApplicationProgress?

  @@index([errandId, status])
  @@unique([errandId, applicantId])   // enforces DuplicateApplicationError at the schema level too, not just app-level
}

model AcceptApplicationProgress {
  applicationId        String      @id @map("_id") @db.ObjectId
  application          Application @relation(fields: [applicationId], references: [id])
  errandId              String      @db.ObjectId
  correlationId         String
  paymentTransactionId  String?     @db.ObjectId
  status                String      @default("CHARGE_INITIATED")   // CHARGE_INITIATED|CHARGE_FAILED|ACCEPTED|ERRAND_ASSIGNED|COMPLETED
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
}
```

## Domain entity methods

**`Application`**
- `create(errandId, applicantId, originType, proposal, proposedAmount)` — starts `PENDING`
- `accept(correlationId)` — `PENDING → ACCEPTED`
- `reject(correlationId?)` — `PENDING → REJECTED`; optional `correlationId` param since this is called both directly (fresh id) and by `RejectOtherApplicationsSaga` (inherited id — see main doc's correlation convention)

**`AcceptApplicationProgress`**
- `create(applicationId, errandId, correlationId)` — starts `CHARGE_INITIATED`
- `recordPaymentTransaction(paymentTransactionId)`
- `markAccepted()` / `markErrandAssigned()` / `markCompleted()` / `markFailed()` — each is a guarded transition, only valid from the expected preceding status (this is what makes the resume logic idempotent/safe to replay)

## Repository interfaces

```typescript
abstract class IApplicationRepository {
  abstract save(application: Application): Promise<void>;
  abstract findById(id: string): Promise<Application | null>;
  abstract findByErrandId(errandId: string): Promise<Application[]>;
  abstract findPendingByErrandId(errandId: string): Promise<Application[]>;
  abstract findByApplicantId(applicantId: string, pagination: { limit: number; cursor?: string }): Promise<{ items: Application[]; nextCursor?: string }>;
  abstract existsByErrandAndApplicant(errandId: string, applicantId: string): Promise<boolean>;
}

abstract class IAcceptApplicationProgressRepository {
  abstract save(progress: AcceptApplicationProgress): Promise<void>;
  abstract findByApplicationId(applicationId: string): Promise<AcceptApplicationProgress | null>;
}
```

## Access policy (used by all the read-side queries below)

```typescript
class ApplicationAccessPolicy {
  async canView(requesterUserId: string, application: Application): Promise<boolean> {
    // resolves the errand's client, the applicant Party (individual or org membership), 
    // and checks requesterUserId against both — never trusts a client-claimed role
  }
}
```

## DTOs

```typescript
// commands/submit-application/submit-application.request.dto.ts
interface SubmitApplicationRequestDto {
  errandId: string;
  applicantId: string;
  originType: 'BID' | 'DIRECT_OFFER';
  proposal: string;
  proposedAmount: { amountMinorUnits: number; currency: string };
}
interface SubmitApplicationResponseDto {
  applicationId: string;
}

// commands/request-application-acceptance/request-application-acceptance.request.dto.ts
interface RequestApplicationAcceptanceRequestDto {
  applicationId: string;
  requesterPartyId: string;   // client for BID, offered member for DIRECT_OFFER
  paymentMethodId: string;
}

// commands/reject-application/reject-application.request.dto.ts
interface RejectApplicationRequestDto {
  applicationId: string;
  requesterPartyId: string;
}

// queries/get-application/get-application.request.dto.ts
interface GetApplicationRequestDto {
  applicationId: string;
  requesterUserId: string;
}
// queries/get-application/get-application.response.dto.ts
interface ApplicationResponseDto {
  id: string;
  errandId: string;
  applicantId: string;
  originType: string;
  status: string;
  proposal: string;
  proposedAmount: { amountMinorUnits: number; currency: string };
  createdAt: string;
}

// queries/list-errand-applications/list-errand-applications.request.dto.ts
interface ListErrandApplicationsRequestDto {
  errandId: string;
  requesterUserId: string;
  limit: number;
  cursor?: string;
}

// queries/get-my-application/get-my-application.request.dto.ts
interface GetMyApplicationRequestDto {
  errandId: string;
  applicantId: string;
}

// queries/get-application-summary/get-application-summary.request.dto.ts
interface GetApplicationSummaryRequestDto {
  applicantId: string;
}
interface ApplicationSummaryResponseDto {
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
}

// queries/list-my-applications/list-my-applications.request.dto.ts
interface ListMyApplicationsRequestDto {
  applicantId: string;
  limit: number;
  cursor?: string;
}
```

## Open items

None new beyond what's already tracked in `docs/flows/application-accept-flow.md` (the `DIRECT_OFFER` decline branch, fully resolved via `errand-reassignment-flow.md`).
