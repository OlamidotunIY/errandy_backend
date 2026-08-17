# Errand Platform — Architecture Index

This is the top-level index. Full detail lives in two places:
- **`docs/modules/`** — one file per module: Prisma models, domain entity methods, repository interfaces, DTOs for every command/query, folder placement.
- **`docs/flows/`** — one file per business process: full sequence walkthrough, event tables, correlation-id scope, EIP/DDD pattern callouts, algorithm callouts.

This doc is deliberately kept light — Decision Log, standing conventions, and an index — specifically so detail lives in exactly one place and can't drift out of sync the way it briefly did (the `escrow`/`chat` corrections below were caused by exactly that duplication).

## Decision Log

1. **`Client`/`Provider`/`Organization` unified via the Party pattern** (Fowler, *Analysis Patterns*) — a shared `Party` identity, with `Person`/`Organization` for structure and `ProviderRole` for time-varying capability, rather than one wide table with a type flag. Adding/removing provider capability = inserting/deleting a `ProviderRole` row, not mutating flags on a shared record. See `docs/modules/party.md`.
2. **`users` is not our module.** better-auth owns identity entirely; we integrate via an Anti-Corruption Layer translating its lifecycle into our own `AuthUserRegistered` event. See `docs/flows/user-registration-flow.md`.
3. **`admin` is not a module.** Admins are better-auth users who never get a `Party`; permissions via better-auth's admin plugin (`createAccessControl`).
4. **Multi-currency, market-isolated.** Every amount is a `Money` value object (refined version: generic minor-unit naming, N-way proportional `split()` via the Largest Remainder Method, `Intl.NumberFormat` for display — see `money.entity.ts`). `Market` (seed data) ties one country to one currency; a `Party`/`Errand` in one market is structurally invisible to another.
5. **`Ledger`, never `Transaction`** — the sole source of truth for wallet money movement; `Wallet.balanceMinorUnits` is a cached projection, reconciled nightly.
6. **`Category`** — hierarchical, shared between `errands` and `service`. Only leaf categories carry `requiredTier`.
7. **`ErrandAssignment`** — an errand can have multiple assigned workers, each individually confirming (cannot un-confirm, can edit/add proof). `Errand.complete()` gates on all confirmed, with a 24-hour system auto-accept if the client doesn't act (`completedBy: CLIENT | SYSTEM`).
8. **No "Process Manager" class.** The pattern that replaced it: a persisted progress entity (e.g. `AcceptApplicationProgress`) + ordinary command handlers + a BullMQ processor bridging an async webhook back into a command. Used only where money is at stake and crash-recovery matters (`application`'s accept flow, `wallet`'s withdrawal flow).
9. **Sagas vs. process managers, precisely defined** — a saga is a thin `@Saga()`, one event → one command, no persisted state. Several things once mislabeled "process manager" were reclassified as sagas once it was clear they had no real compensation logic (`EscrowReleaseSaga`, `EscrowRefundSaga`, `DisputeResolutionSaga`, `AutoKYCReviewSaga`).
10. **Withdrawal debits immediately on request** (prevents a double-withdrawal race); failure issues a compensating credit and **does not auto-retry** — user is notified, must manually re-initiate.
11. **Dispute can only be raised after `Errand.status = COMPLETED`** — never mid-job.
12. **Rating has two contexts** — `CLIENT_FACING` (score + comment, public, recency-weighted average) and `INTERNAL` (org↔member, score only, never public — a `comment` on an `INTERNAL` rating is a validation error, not silently dropped).
13. **MongoDB modeling conventions, established while building `docs/modules/`**:
    - Cross-*aggregate* references are always plain scalar fields, **never** a Prisma `@relation` — that relation sugar is reserved for composition *within* one aggregate (e.g. `Person`/`Organization`/`ProviderRole` sharing `Party`'s PK).
    - Small, **per-document-bounded** embedded collections (a handful of verification steps, one person's trusted circle) → Prisma composite types (`type` blocks).
    - **Unbounded**, independently-paginated collections (chat messages) → their own real collection, referenced by id, never embedded — MongoDB's document-size limit and the "massive array" anti-pattern make embedding a real risk, not just a style preference.
    - Prisma **cannot** create a true `2dsphere` geospatial index via `@@index` — it must be asserted via a raw Mongo command, on every deploy (`db push` can silently drop it). See `docs/modules/address.md` and `docs/modules/errands.md`.
14. **Corrections caught via cross-referencing `docs/modules/` against this doc**: `escrow` never listens to events directly — always explicitly commanded by whichever flow orchestrates it (not a `PaymentSucceeded`/`DisputeResolved` subscriber, as an earlier draft of this doc incorrectly implied). `ChatMessage` is its own collection, not embedded in `ChatThread`.
15. **Cancel — resolved.** `Application.cancel()`/`Errand.cancel()` valid only pre-start (`Errand.status = ASSIGNED`). This un-defers `NoShowDetectionJob` (hourly scan on a new `Errand.expectedStartAt` field) and `EscrowRefundSaga` (valid here since escrow is still `HELD` pre-completion — a genuinely different code path from the post-completion dispute refund, which acts on `wallet`'s pending balance instead). Also introduces `RelistErrandCommand` (finally using the long-unused `relistedFromErrandId` field) and `RemoveAssignmentCommand` (org-internal member swap, distinct from a full cancel). A new gap surfaced in the process: mid-job (`IN_PROGRESS`) abandonment has no resolution path. See `docs/flows/cancellation-flow.md`.
16. **`Wallet` redesigned**: no separate `Withdrawal` entity — `payment-gateway`'s `PaymentTransaction` gained a `direction: CHARGE|TRANSFER` field and owns outbound transfer status instead. `Wallet.partyId` (organizations need their own withdrawable wallet). Three-tier balance (`ACTIVE_ERRAND`/`PENDING`/`AVAILABLE`, via paired `LedgerEntry` bucket-transfers) plus sequence-based optimistic concurrency. `BankAccount` matches on `currency`, not `marketId`. See `docs/modules/wallet.md`.
17. **Dispute window = wallet's pending window, 7 days.** A dispute resolved within that window reverses the wallet's pending balance (`ReversePendingCommand`), not `Escrow.refund()` (already finalized by then). `Escrow.refund()` now applies only to the pre-completion cancel path. See `docs/modules/dispute.md`.
18. **GraphQL, not REST** — every module's API surface is GraphQL (`Mutation`/`Query`/`Subscription` fields), except the payment gateway's inbound webhook, which stays REST out of necessity. See the API convention section above.
19. **`ClientRole` added** to `party` — every `Party` gets one at creation (unlike `ProviderRole`, which is added later), holding `defaultPaymentMethodId`. The actual `PaymentMethod` entity lives in `payment-gateway`.
20. **Payment method verification + `FailedRefund` tracking** — adding a payment method triggers a small verification charge (the charge succeeding is the verification signal, independent of the refund's outcome) followed by an immediate refund; if that refund fails, it's recorded in `FailedRefund` for manual admin resolution rather than silently lost, via the same bridge→queue→processor→DLQ pattern as other money-critical async work. See `docs/flows/payment-method-verification-flow.md`.
21. **Platform fee — 20%, 0% on a wallet's first-ever payout** — determined via `wallet`'s own `LedgerEntry` history (does a `PENDING_CREDIT` already exist for this wallet), not `party`'s `completedErrandsCount`, specifically to avoid a race between two independent listeners on `ErrandCompleted`. Applied once per errand, against the applicant's wallet, before the existing org/worker split.

## Correlation ID convention

- A **fresh `correlationId`** is generated once, at the top-level command that starts a business transaction.
- Threaded through every event/command that fires as a **direct, synchronous consequence**, across however many modules the cascade touches.
- **Stops** once the cascade has no further direct consequence.
- **Arbitrary-delay workflows never share a `correlationId` across the gap** (share→confirm, offer→accept/decline, submission→review, completion→rating) — the next step is its own new transaction, linked only by a persisted reference id, never `correlationId`. This recurs constantly — see every file in `docs/flows/`.

## Conventions — folder structure and async patterns

```
src/modules/<module-name>/
├── domain/
│   ├── entities/            <- includes progress-tracking entities like AcceptApplicationProgress
│   ├── value-objects/
│   ├── repositories/         <- interfaces only
│   ├── events/
│   └── errors/
├── application/
│   ├── commands/              <- ICommandHandler, @CommandHandler
│   ├── event-handlers/        <- IEventHandler, @EventsHandler (flat, includes async bridge handlers)
│   ├── sagas/                 <- @Saga() — thin, single hop, no persisted state
│   ├── processors/            <- BullMQ @Processor/WorkerHost — money-critical async continuations + DLQ
│   ├── queries/
│   └── jobs/
├── infrastructure/
│   ├── mappers/
│   └── repositories/
└── <module-name>.module.ts
```

**Money-critical async continuation pattern**: in-memory domain event fires → thin bridge `@EventsHandler` enqueues a BullMQ job (no business logic itself) → `@Processor`/`WorkerHost` dispatches the resuming command, using an `ErrorClassifier` to distinguish transient vs. permanent failures, recording permanent ones via `IDeadLetterRepository`. Every resumed command handler checks a persisted `status` before acting (Idempotent Receiver — safe to replay).

## Integration concerns (not modules)

**better-auth** — owns all identity. We supply `sendVerificationEmail`/`sendOTP` delivery callbacks and a `databaseHooks.user.create` Anti-Corruption Layer publishing `AuthUserRegistered`. See `docs/flows/user-registration-flow.md`.

**Admin permissions** (better-auth admin plugin) — admins are better-auth users with no `Party`. Permissions via `createAccessControl` (`verification: [...]`, `dispute: [...]`), checked with `auth.api.userHasPermission(...)` in every privileged command handler.

## API convention — GraphQL, not REST

**GraphQL everywhere, except the payment gateway's inbound webhook**, which has to stay a raw REST endpoint (gateways don't send GraphQL). Every module's "Presentation" section reflects this: commands become `Mutation` fields, queries become `Query` fields, using this shape:

```graphql
type Mutation {
  addProviderRole(input: AddProviderRoleInput!): AddProviderRoleResult!
}
type Query {
  publicProviderProfile(partyId: ID!): ProviderProfile
}
```

- **Input types** = what were called `*RequestDto` in `docs/modules/*.md` — the TypeScript interfaces already documented there are the right shape for these, just consumed by a resolver instead of a controller.
- **Result/object types** = what were called `*ResponseDto`. Same relationship.
- **Auth** is expressed as a directive/guard on the field, not a route table: `@auth`, `@auth(permission: "dispute:resolve")`, or no directive for public fields — each module's Presentation table now lists `Field | Type | Auth` instead of `Method | Route | Auth`.
- **Internal-only commands** (never exposed to a client at all — `AcceptApplicationCommand`, `RejectOtherApplicationsCommand`, etc.) simply have **no corresponding `Mutation` field** — they're only ever reachable via `CommandBus.execute()` from within a saga/processor, never from the GraphQL layer.

**REST, only for**: `POST /webhooks/payment-gateway` — everything else in `payment-gateway.md`'s Presentation section is GraphQL like every other module.

## Module index

| Cluster | Module | Detail |
|---|---|---|
| Identity & access | `party` | `docs/modules/party.md` |
| | `address` | `docs/modules/address.md` |
| | `verification` | `docs/modules/verification.md` |
| Marketplace core | `category` | `docs/modules/category.md` |
| | `service` | `docs/modules/service.md` |
| | `errands` | `docs/modules/errands.md` |
| | `application` | `docs/modules/application.md` |
| Money & escrow | `payment-gateway` | `docs/modules/payment-gateway.md` |
| | `escrow` | `docs/modules/escrow.md` |
| | `wallet` | `docs/modules/wallet.md` |
| Trust & social | `chat` | `docs/modules/chat.md` |
| | `rating` | `docs/modules/rating.md` |
| | `trusted-circle` | `docs/modules/trusted-circle.md` |
| Support | `dispute` | `docs/modules/dispute.md` |
| | `notification` | `docs/modules/notification.md` |
| | `platform-analytics` | `docs/modules/platform-analytics.md` |

## Flow index

See `docs/flows/README.md` for all 13: application accept, user registration, errand discovery, errand creation, errand reassignment, trusted circle, verification, errand completion, withdrawal, dispute, rating, payment method verification, cancellation.

## Patterns index

See `docs/flows/patterns-index.md` — every EIP/DDD pattern and algorithm callout, cross-referenced to where it's used.

## Open items (consolidated across all docs)

- **Mid-job abandonment** — surfaced while designing Cancel: nothing currently handles a job abandoned while `IN_PROGRESS`. The one substantial gap left in the whole system.
