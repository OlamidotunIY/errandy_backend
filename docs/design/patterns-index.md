# Patterns Index

Cross-reference of Enterprise Integration Patterns (Hohpe & Woolf) and DDD building blocks used across the system, and which flows they show up in. Each flow document also calls these out inline, at the point they're used — this index is for "everywhere we use X," not a replacement for reading the flow itself.

## Enterprise Integration Patterns

| Pattern | What it means here | Used in |
|---|---|---|
| **Correlation Identifier** | A `correlationId` generated once per top-level transaction, threaded through every event/command in that cascade, stopping once the cascade has no further direct consequence. See the Correlation ID convention section of the main architecture doc. | Every flow |
| **Process Manager** | A stateful orchestrator (persisted progress row) coordinating multiple steps across module boundaries, with an explicit failure branch. Reserved for money-critical flows where a mid-flight crash would leave bad state. | Application accept, Withdrawal |
| **Event-Driven Consumer / Publish-Subscribe Channel** | Domain events published on the in-memory `EventBus`; any number of `@EventsHandler`/`@Saga()` listeners react independently, unaware of each other. | Nearly every flow — Notification is the extreme case (near-universal subscriber) |
| **Competing Consumers** | BullMQ queue workers pulling jobs off a shared queue, so throughput scales horizontally and one slow job doesn't block others. | Application accept (payment continuation), Escrow auto-release, Bank account resolution |
| **Dead Letter Channel** | Permanently-failed jobs (per `ErrorClassification.PERMANENT`) get recorded via `IDeadLetterRepository` instead of silently vanishing after retries are exhausted. | Application accept, Escrow release, Bank account resolution |
| **Idempotent Receiver** | Handlers that check current state before acting, so redelivery/replay of the same event/job is a safe no-op rather than a duplicate side effect (e.g. checking `progress.status` before each step). | Application accept, Withdrawal |
| **Claim Check** | Large payloads (verification documents, dispute evidence) stored via `DocumentStorageAdapter`, with only a reference URL carried in events/commands — never the file itself. | Verification, Dispute |
| **Content-Based Router** | A handler subscribed to one event type but only acting on a subset of it, based on payload content (e.g. `if (event.purposeType !== 'APPLICATION_ACCEPT') return;` pattern, prior to `purposeType` removal — now the router key is presence of a matching progress row instead). | Application accept |
| **Transactional Outbox** *(recommended, not yet built)* | Persisting the to-be-published event in the same DB transaction as the aggregate save, with a separate poller pushing it to the broker — guarantees no event is lost to a crash between save and publish. | Recommended for any money-critical event publish; not yet implemented |

## DDD Building Blocks

| Pattern | Where |
|---|---|
| **Aggregate** | `Application`, `Errand`, `Escrow`, `Wallet`, `Profile`, `VerificationProfile`, `TrustedCircle`, `Dispute`, `Rating` |
| **Entity (non-root)** | `VerificationStep` (within `VerificationProfile`), `ChatMessage` (within `ChatThread`), `TrustedCircleMember` (within `TrustedCircle`), `ErrandAssignment` (references `Errand`, arguably its own small aggregate — see errand-completion-flow.md) |
| **Value Object** | `Money`, `Coordinates` |
| **Domain Service** | `ProfileEligibilityPolicy`, `VerificationGatePolicy` (cross-aggregate checks that don't belong to one entity) |
| **Domain Event** | See each flow's event table |
| **Repository** | One per aggregate root, interface in `domain/`, implementation in `infrastructure/` |
| **Ubiquitous Language discipline** | See main doc's Decision Log for corrected terms (`Ledger` not `Transaction`, `Money` not `XKobo`, etc.) |
| **Anti-Corruption Layer** | Thin translator between an external system's model and ours — e.g. better-auth's `databaseHooks` translating into our own `AuthUserRegistered` event, so nothing downstream ever depends on better-auth's internal shapes | `user-registration-flow.md` |

## Algorithms referenced

| Need | Algorithm / structure | Reference |
|---|---|---|
| Recency-weighted rating average | Exponential decay weighting | Not really a CLRS topic — this is closer to a numerical/statistics formula than a discrete algorithm. Any standard "exponential smoothing" reference covers it. |
| Second-degree trust count (mutual circle overlap) | Set intersection between two profiles' confirmed circle members | CLRS-equivalent: this is just a hash-set intersection, O(n+m) — not sophisticated enough to need graph algorithms unless you later want "trust distance" (shortest path through the trust graph), which would then be BFS — CLRS ch. 22 (Elementary Graph Algorithms) |
| Bank-account/webhook retry backoff | Exponential backoff with jitter | Not CLRS — this is a systems/queueing concept, covered in BullMQ's own backoff config, not an algorithms text |
| Nearby-errand discovery for workers | Database-native geospatial index (R-tree/GiST or geohash), then composite-score ranking + top-K | Not really CLRS territory for the geospatial part — closest is Ch. 33 (Computational Geometry), loosely related at best. Practical answer: use the database's built-in geospatial index rather than implementing one. Ranking/top-K reuses the heap approach above. |
