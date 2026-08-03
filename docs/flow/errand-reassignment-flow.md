# Flow: Errand Reassignment (After a Declined Direct Offer)

## Actors

- **Client** — whose `TRUSTED_DIRECT_ASSIGN` offer was declined
- **trusted-circle, errands modules**

## Context

From `errand-creation-flow.md`, Path C: when the offered member declines, the `Errand` stays `DRAFT`, unassigned. No auto-fallback to `OPEN_BID`. This flow is what helps the client decide what to do next.

## Step-by-step sequence

1. `ApplicationRejected` fires (the member declined) → client sees the errand is back to unassigned
2. Client requests suggestions: `SuggestReassignmentCandidatesQuery { errandId }`
3. Handler builds two candidate sets:
   - **From circle**: the client's own `TrustedCircle`, filtered to `CONFIRMED` members whose `tier` meets `errand.requiredTier` and who offer the errand's `categoryId` (via their `Service` listing or general capability)
   - **External**: profiles matching `categoryId`/`requiredTier`/`marketId`, not in the client's circle, ranked by composite trust score (`avgRatingCached`, `log(trustedByCount + 1)`, `tier`, `completedErrandsCount` — weights tunable, not fixed)
4. Both sets merged, each result tagged `fromCircle: boolean`, ranked, top-K selected (min-heap approach, same as `errand-discovery-flow.md` — CLRS Ch. 6/9)
5. Client picks one, calls `OfferErrandToTrustedMemberCommand { errandId, offeredToProfileId }` (errand already exists — this just creates a fresh `PENDING`/`DIRECT_OFFER` `Application` against it) **or** decides to give up on direct-assign and calls `PublishErrandCommand { errandId }` instead, making it publicly visible (`OPEN_BID`-equivalent, though `sourceType` stays `TRUSTED_DIRECT_ASSIGN` as an immutable origin record — see the open item in `errand-creation-flow.md`)
6. Either path re-enters an already-documented flow: a new offer goes back through `application-accept-flow.md`'s `DIRECT_OFFER` branch; publishing goes through `errand-creation-flow.md` Path A's later steps

## Event table

No new events — this flow is composed entirely of existing events/commands from `errand-creation-flow.md` and `application-accept-flow.md`; it's the *query and decision* step that sits between a decline and whichever path the client picks next.

## Algorithmic component

Same composite-score ranking + top-K selection as `errand-discovery-flow.md` — reuses the identical approach rather than inventing a second one. Worth implementing as one shared ranking utility rather than duplicating the heap logic in two places.

## Open items

- **Resolved**: one-at-a-time, as designed above — not parallel multi-offers. Simpler to reason about (no race between two members both accepting), and the suggestion list makes re-offering to the next candidate fast enough that the "slower but simpler" tradeoff is worth it.
