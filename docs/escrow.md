# Escrow wallet flow (hold + release)

All stored amounts are **integer minor units (kobo)** to avoid Float/Decimal issues on Prisma Mongo.

## Lifecycle

1. **Client accepts an application**
   - Charge client via gateway with idempotency key: `CHARGE_ERRAND_ACCEPT:<errandId>`
   - Create `Escrow` with `status=FUNDED`
   - Write immutable ledger entry:
     - `Transaction.type=ESCROW_HOLD`
     - `Transaction.reference=ESCROW_HOLD:<errandId>`
     - `ownerType=CLIENT`, `ownerId=<clientId>`

2. **Provider marks errand completed**
   - Transition escrow `FUNDED -> HELD` and set `holdUntil = now + 3 days`
   - Credit provider pending earnings:
     - `Wallet.held += amountNetWorker`
     - `Transaction.type=ESCROW_PENDING_CREDIT`
     - `Transaction.reference=ESCROW_PENDING_CREDIT:<errandId>`
     - `ownerType=PROVIDER`, `ownerId=<providerId>`

3. **Cron: release eligible escrows**
   - Find escrows where `status=HELD` and `holdUntil <= now`
   - For each, atomically:
     - Lock: `HELD -> RELEASING`
     - Move wallet balances: `held -= amountNetWorker`, `available += amountNetWorker`
     - Ledger: `Transaction.type=ESCROW_RELEASE`, `reference=ESCROW_RELEASE:<errandId>`
     - Finalize: `status=RELEASED`, set `releasedAt`

## Running the release job

- Script: `errandy_backend/scripts/release-eligible-escrows.ts`
- Suggested schedule: every 2–5 minutes
- Optional env:
  - `ESCROW_RELEASE_LIMIT` (default `50`)

## Minimal test plan

1. **Duplicate acceptApplication**
   - Call accept twice for the same errand/application.
   - Expect: only one escrow exists (`Escrow.errandId` unique), no double charge (gateway idempotency key), and only one `ESCROW_HOLD:<errandId>` transaction.

2. **Duplicate markErrandCompleted**
   - Call completion twice for the same errand.
   - Expect: escrow transitions `FUNDED -> HELD` once, wallet `held` credited once, only one `ESCROW_PENDING_CREDIT:<errandId>` transaction.

3. **Concurrent release workers**
   - Run 2 instances of the release script simultaneously.
   - Expect: each eligible escrow is released once, only one `ESCROW_RELEASE:<errandId>` transaction, wallet balances correct.

4. **Hold time respected**
   - Set `holdUntil` in the future.
   - Expect: release job skips it until the timestamp passes.

## Reconciliation approach

Wallet fields are cached aggregates; source-of-truth is the immutable `Transaction` ledger.

- For a given `(ownerId, ownerType)`:
  - Compute expected totals by summing transactions by type/stage:
    - `available` should match `FUND + ESCROW_RELEASE - WITHDRAWAL ...` (per your business rules)
    - `held` should match `ESCROW_PENDING_CREDIT - ESCROW_RELEASE`
- Compare computed totals to stored `Wallet.available/held`.
- If drift is detected:
  - Investigate missing/duplicate ledger references (`reference` is unique)
  - Repair by recomputing wallet balances from ledger in an admin-only maintenance task.
