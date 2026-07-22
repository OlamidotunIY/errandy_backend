# Utils — DDD & EIP Analysis

## 1. Current Responsibility

Utility functions:

- **Event emitter**: `event-emitter.utils.ts` — custom event emitter configuration (likely defines event types).
- **Haversine distance**: `haversine.ts` — calculates distance between two coordinates (geospatial utility).
- **OTP utils**: `otp.utils.ts` — generates/validates one-time passwords (phone/email verification).

**Files**: `event-emitter.utils.ts`, `haversine.ts`, `otp.utils.ts`.

## 2. Bounded Context Assessment

**This is a mix of infrastructure and leaked domain logic**:

1. **Event emitter utils** — infrastructure (framework configuration).
2. **Haversine distance** — **DOMAIN LOGIC** (geospatial calculation is core to errand matching) — should be a value object or domain service.
3. **OTP utils** — **DOMAIN LOGIC** (verification is core to user onboarding) — should be in Verification module.

**Verdict**: Split Utils:

- **Infrastructure utils** (event emitter) → `common/utils/` or inline in modules.
- **Domain logic** (haversine, OTP) → move to appropriate bounded contexts (Errands, Verification).

## 3. Domain Model Audit

**Leaked domain logic**:

1. **Haversine distance**:
   - Used by: Errands (location-based search), Provider (geospatial matching).
   - Should be: `Location` value object with `distanceTo(other: Location): number` method.

2. **OTP utils**:
   - Used by: Verification (phone/email OTPs).
   - Should be: `OtpCode` value object with `generate(): string`, `validate(code: string): boolean` methods.

## 4. Layering Violations

**Domain logic in Utils**:

- `haversine.ts` contains geospatial calculation — this is **core domain logic**, not a utility.
- `otp.utils.ts` contains verification logic — this is **domain logic**, not a utility.

**Recommendation**: Move domain logic out of Utils into appropriate modules.

## 5. Repository Pattern Gap

**Not applicable** — Utils is infrastructure, but leaked domain logic should be refactored.

## 6. EIP Opportunities

**None** — Utils is infrastructure (utilities don't fit EIP patterns).

## 7. Cross-Cutting Concerns

**Validation**:

- OTP validation should be in Verification module (not Utils).

## 8. GraphQL-Specific Notes

**Not applicable** — Utils is infrastructure, not exposed via GraphQL.

## 9. Target Structure

```
src/common/utils/
  event-emitter.utils.ts        # Infrastructure: Event emitter config

src/errands/
  domain/
    value-objects/
      Location.ts                 # Value object with distanceTo(other): number (uses haversine)

src/verification/
  domain/
    value-objects/
      OtpCode.ts                  # Value object with generate(), validate(code) methods
```

**Recommendation**: Move domain logic out of Utils. Keep only technical utilities in Utils.

## 10. Migration Risk & Priority

**Risk**: **MEDIUM**

- Utils contains domain logic (haversine, OTP) — refactoring requires moving logic to domain modules.
- Haversine is used by Errands (location-based search) — critical for errand matching.

**Priority**: **PHASE 2 (parallel with Errands/Verification)**
**Rationale**:

1. Haversine should be refactored with Errands (extract Location value object).
2. OTP should be refactored with Verification (extract OtpCode value object).
3. Utils audit is important (ensure no other domain logic leaked into utilities).

**Migration steps**:

1. **Move haversine to Errands** (extract `Location` value object).
2. **Move OTP to Verification** (extract `OtpCode` value object).
3. **Audit Utils** — ensure no other domain logic leaked in.
4. **Keep only technical utilities** in Utils (event emitter, date formatting, etc.).
