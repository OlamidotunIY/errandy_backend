# Flow: Errand Creation (Three Sourcing Paths)

Covers `Errand.sourceType`'s three values. All three share the same early gate checks and diverge only at the point of publishing/assigning.

## Actors

- **Client** (a `Profile` with `CLIENT` capability)
- **errands module** — owns `Errand` throughout
- **category module** — supplies `requiredTier` for open-bid errands

## Shared preconditions (all three paths)

- `VerificationGatePolicy.isFullyVerified(profile)` — `User.emailConfirmedAt && User.phoneConfirmedAt`. `CLIENT` capability needs nothing beyond this (no `VerificationProfile` steps), per the earlier decision that client verification is deliberately lightweight.
- `Profile.marketId` is implicit context for everything below — a client only ever sees/creates errands, categories, and candidates within their own market. No cross-market logic exists anywhere in this flow.

---

## Path A — Open bid

1. `CreateErrandCommand { clientId, title, description, addressId, categoryId, budget, currency }`
2. Handler validates `Category.findById(categoryId)` is a **leaf** category (has no children) — parent categories aren't assignable, they're browsing-only groupings
3. `Errand` saved: `status: DRAFT`, `sourceType: OPEN_BID`, `requiredTier: category.requiredTier`, `marketId: client.marketId`
4. `ErrandCreated { errandId, clientId, sourceType, correlationId }` — fresh id, stops at Notification
5. Client later calls `PublishErrandCommand { errandId }` → `status: PUBLISHED` → `ErrandPublished { errandId, correlationId }` *(fresh id — arbitrary time may have passed since creation)*
6. Now visible in `BrowseOpenErrandsQuery`, filtered by `marketId = requester.marketId` — this is the market-isolation boundary described in the main doc (Ghana never sees Nigeria)
7. Workers submit `Application`s → see `application-accept-flow.md` for everything from here on

## Path B — Service booking

1. Client finds a `Service` via `SearchServicesQuery` (already filtered to their own market)
2. `BookServiceCommand { clientId, serviceId, addressId }`
3. Handler loads the `Service`, derives `categoryId`/`requiredTier` from it (re-validated here, not just trusted from listing time, in case the lister's tier has since dropped)
4. `Errand` saved directly as `status: ASSIGNED`, `sourceType: SERVICE_BOOKING` — **skips `DRAFT`/`PUBLISHED` entirely**, since the listing itself represents standing consent (no offer/accept step needed, unlike Path C)
5. `ErrandCreated` + `ErrandAssigned` raised together, same `correlationId`
6. Same downstream as any other assignment: `AssignErrandCommand`-equivalent creates the `ErrandAssignment` row, `ChatLifecycleSaga` opens the thread, payment is charged (via the same charge-then-confirm mechanics as `application-accept-flow.md`, just without an `Application` row involved at all)

## Path C — Trusted direct assign

1. `AssignErrandToTrustedMemberCommand { clientId, title, description, addressId, categoryId, budget, currency, offeredToProfileId }`
2. Handler validates the offered member is `CONFIRMED` in the client's `TrustedCircle`
3. `Errand` saved: `status: DRAFT` (deliberately **not** published — "never really goes public if it's already assigned to someone"), `sourceType: TRUSTED_DIRECT_ASSIGN`, `requiredTier: category.requiredTier`
4. Same transaction also creates `Application { originType: DIRECT_OFFER, status: PENDING, applicantId: offeredToProfileId }`
5. `ErrandCreated` + `ApplicationSubmitted` raised, same `correlationId`
6. From here, it's the `DIRECT_OFFER` branch of `application-accept-flow.md` — the offered member accepts or declines
7. **On decline**: see `errand-reassignment-flow.md` (pending) — client gets a suggestion list (own trusted circle + external high-trust candidates) and either re-offers via `OfferErrandToTrustedMemberCommand` or publishes it to `OPEN_BID`

## Event table

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `ErrandCreated` | `errands` | `{ errandId, clientId, sourceType, correlationId }` | Notification |
| `ErrandPublished` | `errands` | `{ errandId, correlationId }` | Notification, search/browse projection (if one exists) |
| `ErrandAssigned` | `errands` | `{ errandId, acceptedApplicationId?, correlationId }` | `ChatLifecycleSaga`, Notification |
| `ApplicationSubmitted` | `application` | `{ applicationId, errandId, applicantId, correlationId }` | Notification |

## Algorithmic component

None beyond a straightforward tree lookup (is this category a leaf) — trivial parent-pointer check, not worth a dedicated algorithm reference.

## Open items carried forward

- **Resolved**: `sourceType` stays immutable — it's an origin record, not a current-mode indicator. If a declined `TRUSTED_DIRECT_ASSIGN` errand later gets published, `status` changes to `PUBLISHED` but `sourceType` still reads `TRUSTED_DIRECT_ASSIGN`, preserving the true origin for analytics/reporting.
- No auto-expiry timeout on Path B (service booking) equivalent to `ArchiveInactiveErrandsJob` was discussed — bookings go straight to `ASSIGNED` so this shouldn't apply, but worth a sanity check once written up in full.
