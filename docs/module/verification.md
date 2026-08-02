# Module: verification

## Folder placement

```
src/modules/verification/
├── domain/
│   ├── entities/
│   │   └── verification-profile.entity.ts   (VerificationStep is a value-shaped embedded type, not its own entity file — see Prisma note below)
│   ├── value-objects/
│   │   └── step-type.vo.ts   (NIN_VERIFIED | LICENSE_VERIFIED | BUSINESS_REG_VERIFIED)
│   ├── repositories/
│   │   └── verification-profile.repository.interface.ts
│   ├── events/
│   │   ├── verification-step-submitted.event.ts
│   │   ├── verification-step-approved.event.ts
│   │   ├── verification-step-rejected.event.ts
│   │   └── verification-completed.event.ts
│   └── errors/
│       ├── verification-profile-not-found.error.ts
│       ├── step-already-approved.error.ts
│       └── missing-required-documents.error.ts
├── application/
│   ├── commands/
│   │   ├── submit-verification-step/
│   │   ├── approve-verification-step/
│   │   └── reject-verification-step/
│   ├── sagas/
│   │   └── auto-kyc-review.saga.ts   (thin — VerificationStepSubmitted[NIN] → external API → approve/leave-pending)
│   └── queries/
│       ├── get-verification-profile-by-party-id/
│       └── list-pending-verification-steps/
├── infrastructure/
│   ├── adapters/
│   │   ├── nin-verification-api.adapter.ts
│   │   ├── license-verification-api.adapter.ts
│   │   └── document-storage.adapter.ts
│   ├── mappers/
│   │   └── verification-profile.mapper.ts
│   └── repositories/
│       └── verification-profile.repository.ts
└── verification.module.ts
```

## Prisma schema — using MongoDB composite types

`VerificationStep`s are always loaded/saved as part of their parent `VerificationProfile` and never queried as independent documents — this is exactly the case Prisma's MongoDB **composite types** (`type` blocks) are for, rather than a separate collection with a foreign key. Cleaner than the collection-based approach for genuinely embedded, always-together data.

```prisma
type VerificationStep {
  stepType        String     // NIN_VERIFIED | LICENSE_VERIFIED | BUSINESS_REG_VERIFIED
  status          String     @default("PENDING")   // PENDING | SUBMITTED | APPROVED | REJECTED
  documentUrls    String[]
  submittedAt     DateTime?
  reviewedAt      DateTime?
  reviewerId      String?    @db.ObjectId   // better-auth admin user id, null if system-approved
  rejectionReason String?
}

model VerificationProfile {
  id            String             @id @default(auto()) @map("_id") @db.ObjectId
  partyId       String             @unique @db.ObjectId   // one per Party, not per subject-type
  steps         VerificationStep[]
  overallStatus String             @default("INCOMPLETE")  // INCOMPLETE | COMPLETE
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
}
```

Mongo can still query into embedded array fields (`steps.status`), so `findPendingSteps()` across every profile works fine without needing `VerificationStep` to be its own collection.

## Domain entity methods

**`VerificationProfile`** (aggregate root)
- `recalculateRequiredSteps(targetTier: ProviderTier)` — adds any newly-required step as `PENDING` if not already present; **never removes** a step that's no longer required, just excludes it from the `overallStatus` check going forward
- `submitStep(stepType, documentUrls)` — moves the matching step to `SUBMITTED`, sets `submittedAt`
- `approveStep(stepType, reviewerId)` — moves to `APPROVED`, recomputes `overallStatus` (`COMPLETE` if every currently-required step is `APPROVED`)
- `rejectStep(stepType, reviewerId, reason)` — moves to `REJECTED`

## Repository interface

```typescript
abstract class IVerificationProfileRepository {
  abstract save(profile: VerificationProfile): Promise<void>;
  abstract findById(id: string): Promise<VerificationProfile | null>;
  abstract findByPartyId(partyId: string): Promise<VerificationProfile | null>;
  abstract findPendingSteps(): Promise<{ verificationProfileId: string; partyId: string; step: VerificationStep }[]>;
}
```

## DTOs

```typescript
// commands/submit-verification-step/submit-verification-step.request.dto.ts
interface SubmitVerificationStepRequestDto {
  partyId: string;
  stepType: 'NIN_VERIFIED' | 'LICENSE_VERIFIED' | 'BUSINESS_REG_VERIFIED';
  documentUrls: string[];   // already-uploaded via DocumentStorageAdapter's own upload endpoint; this command just records the references (Claim Check pattern)
}
interface SubmitVerificationStepResponseDto {
  verificationProfileId: string;
  stepType: string;
  status: 'SUBMITTED';
}

// commands/approve-verification-step/approve-verification-step.request.dto.ts
interface ApproveVerificationStepRequestDto {
  verificationProfileId: string;
  stepType: string;
  reviewerId: string;   // better-auth admin id; permission-checked before this even reaches the handler
}

// commands/reject-verification-step/reject-verification-step.request.dto.ts
interface RejectVerificationStepRequestDto {
  verificationProfileId: string;
  stepType: string;
  reviewerId: string;
  reason: string;
}

// queries/get-verification-profile-by-party-id/get-verification-profile-by-party-id.response.dto.ts
interface VerificationProfileResponseDto {
  partyId: string;
  overallStatus: 'INCOMPLETE' | 'COMPLETE';
  steps: {
    stepType: string;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    // documentUrls and reviewerId deliberately excluded from the party's own view — only surfaced in the admin-facing query below
  }[];
}

// queries/list-pending-verification-steps/list-pending-verification-steps.response.dto.ts
interface PendingVerificationStepResponseDto {
  verificationProfileId: string;
  partyId: string;
  stepType: string;
  documentUrls: string[];   // should be short-lived signed URLs from DocumentStorageAdapter, not permanent public links
  submittedAt: string;
}
```

## Open items

- Resubmission cooldown/limit after a rejection — not decided (fraud-prevention consideration, carried over from `docs/flows/verification-flow.md`).
- `documentUrls` signing/expiry mechanism — flagged above, not yet designed in `DocumentStorageAdapter`.
