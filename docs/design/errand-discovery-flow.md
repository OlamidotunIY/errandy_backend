# Flow: Errand Discovery (Nearby + Recent, for Workers)

Not a state-transition flow like the others — this is a **query-path** doc, included because it has real algorithmic weight: surfacing open errands to a worker/organization, prioritized by proximity to them and recency of posting.

## Actors

- **Worker/Organization** (`Profile` with `PROVIDER` capability) — browsing for open errands
- **errands module** — owns `Errand`, serves the query

## The query

`BrowseOpenErrandsQuery { requesterProfileId, categoryId?, limit, cursor }`

Preconditions, enforced before any ranking logic runs:
- `status = PUBLISHED`
- `marketId = requester.marketId` — the hard market-isolation boundary (Ghana never sees Nigeria), applied first, before distance is even considered
- if `requiredTier` is set, `requester.tier >= requiredTier`

## The actual problem: nearest-neighbor + recency, at scale

Two things need combining: **geographic proximity** (distance from the worker's location to the errand's `Address`) and **recency** (`createdAt`, newer first). Naive approach — compute distance for every published errand in the market, sort — works fine at small scale but degrades badly as errand volume grows, since it's a full table scan every time.

**Recommended approach — don't hand-roll the distance search:**

1. **Use the database's native geospatial index**, not application-level looping over rows. PostgreSQL + PostGIS gives you `ST_DWithin`/`ST_Distance` backed by a GiST index (internally an R-tree); MongoDB gives you a `2dsphere` index with `$near`. Either lets the database do the proximity filtering and rough ordering natively, rather than pulling every row into application memory.
2. **Filter to a bounding radius first** (e.g. `ST_DWithin(errand.location, worker.location, radiusMeters)`) — this uses the index to cheaply exclude everything far away, rather than computing exact distance for every row before filtering.
3. **Rank the remaining (already small) candidate set** by a blended score, since "nearest" and "newest" often trade off (a 2-day-old errand 500m away vs. a 5-minute-old one 4km away — which surfaces first is a product call, not just a technical one):
   ```
   score = w1 · proximityScore(distance) + w2 · recencyScore(ageInMinutes)
   ```
   where `proximityScore`/`recencyScore` are each normalized (e.g. inverse distance, exponential recency decay) onto a comparable 0–1 range before weighting. Same shape as the composite trust score in `errand-reassignment-flow.md` — this recurs anywhere "blend two different-unit signals into one ranking" comes up.
4. **Top-K selection over the ranked candidate set** — same min-heap approach already referenced for reassignment suggestions: push scored candidates, evict the lowest whenever the heap exceeds `limit`. O(n log K) rather than sorting the whole candidate set. *(CLRS Ch. 6, Heaps; Ch. 9, Medians and Order Statistics.)*

**Honest gap in the reference material**: this isn't really a CLRS topic in the way ranking/top-K is — CLRS doesn't cover geospatial indexing (R-trees, geohashing, quad-trees) at all; the closest chapter is **Ch. 33, Computational Geometry**, which is only loosely related background, not a how-to. For the actual geospatial indexing structure, the practical path is: use your database's built-in geospatial index rather than implementing one, and if you want to understand what's underneath it, look up R-trees specifically (Guttman's original paper, or any GIS-focused text/course) — not something *Introduction to Algorithms* covers.

**Simpler alternative if you don't want a full geospatial index yet**: precompute a coarse **geohash** for every `Address` (a string encoding a lat/lng cell — nearby locations share string prefixes), index that column as a plain string index, and query by geohash-prefix match for "in the same rough area" before falling back to precise Haversine-distance calculation on the (now small) result set. Cheaper to set up than PostGIS, less precise, but avoids full scans — a reasonable middle ground if PostGIS/2dsphere isn't already in your stack.

## Sequence

1. Worker opens the discovery screen → `BrowseOpenErrandsQuery { requesterProfileId, categoryId?, limit, cursor }`
2. Handler resolves worker's current location (either their profile's default `Address`, or a live GPS coordinate if the client sends one)
3. Market + tier filters applied (hard preconditions, cheap to check, applied before any geo work)
4. Geospatial index query narrows to candidates within a radius (configurable — this is a tunable business parameter, not fixed forever)
5. Candidates scored (proximity + recency blend), top-K selected via the heap approach
6. Paginated result returned (`cursor` for the next page — since scores can shift as new errands are posted between page loads, cursor-based pagination here is "best effort," not perfectly stable; flagging as a known limitation rather than solving it now)

## Algorithmic component (summary)

- **Nearest-neighbor / geospatial filtering**: database-native geospatial index (PostGIS GiST/R-tree, or MongoDB 2dsphere) — not a CLRS topic; practical answer is "use the database," not "implement it."
- **Composite ranking + top-K selection**: min-heap of size K — CLRS Ch. 6 (Heaps), Ch. 9 (Medians and Order Statistics).

## Open items

- Exact weighting (`w1`/`w2`) between proximity and recency — product decision, not yet made; should be config, not hardcoded.
- Default/max search radius — also a product decision.
- Whether an organization's discovery view aggregates by the org's registered base location, or by wherever its currently-active members happen to be — not yet decided.
