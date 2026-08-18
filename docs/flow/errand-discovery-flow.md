# Flow: Errand Discovery (Nearby + Recent, for Workers)

Not a state-transition flow like the others — this is a **query-path** doc, included because it has real algorithmic weight: surfacing open errands to a worker/organization, prioritized by proximity to them and recency of posting.

## Actors

- **Worker/Organization** (`Party` with a `ProviderRole`) — browsing for open errands
- **errands module** — owns `Errand`, serves the query

## Data modeling correction — MongoDB, not PostGIS

This system runs on MongoDB via Prisma, not Postgres. Two real consequences, confirmed against current Prisma/Mongo docs rather than assumed:

1. **Prisma's schema language cannot create a true `2dsphere` index.** `@@index([location])` only produces a regular index, even if you name it `2dsphere` — Prisma has an open, unresolved feature request for this. The actual index has to be created via a raw Mongo command (`db.<collection>.createIndex({ location: "2dsphere" })`), run as its own deployment/bootstrap step — **and `prisma db push` can silently drop it on the next push**, so it needs re-asserting every deploy, not a one-time setup.
2. **`Errand` needs its own denormalized `location` field**, not just `addressId`. Mongo doesn't do cheap cross-collection joins, so for `$near`/`$geoNear` to be usable at query time, the coordinates have to live directly on the document being queried — copied from the chosen `Address` once, at `CreateErrandCommand` time, not fetched via a lookup into `Address` per candidate.

```prisma
model Address {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  ownerUserId String   @db.ObjectId
  label       String
  street      String
  city        String
  state       String
  country     String
  location    Json     // GeoJSON Point: { type: "Point", coordinates: [longitude, latitude] } — note: longitude first, the opposite of how most UIs present it
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Errand {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  clientId    String   @db.ObjectId   // plain scalar — Party aggregate, no @relation, per the aggregate-boundary rule
  addressId   String   @db.ObjectId
  location    Json     // denormalized copy of Address.location, set once at creation
  state       String   // also denormalized from Address.state — see the hard state filter below
  categoryId  String   @db.ObjectId
  // ...remaining fields as in the main architecture doc
}
```

## The query and its hard filters

`BrowseOpenErrandsQuery { requesterPartyId, categoryId?, radiusKm?, limit, cursor }`

Preconditions, enforced **in this order**, before any ranking logic runs:
1. `status = PUBLISHED`
2. `marketId = requester.marketId` — country-level isolation (Ghana never sees Nigeria)
3. **`errand.state = requester's active address's state`** — a second, more granular hard boundary, exact string match rather than distance-based. State borders are irregular; a radius circle can't reliably respect them, which is exactly why `state` is denormalized onto `Errand` rather than derived from coordinates at query time. An errand just across a state line is never returned, no matter how close it is in raw distance.
4. if `requiredTier` is set, `requester.tier >= requiredTier`
5. **km limit, applied *within* the state boundary**: `radiusKm` if explicitly supplied on this call, else `requester.defaultSearchRadiusKm` if set as a standing preference, else no additional cap (state boundary alone is the limit). The state filter always applies regardless — a worker's radius can never extend past their own state.

```typescript
// bootstrap/ensure-mongo-indexes.ts — run on every deploy, not a one-time migration
await prisma.$runCommandRaw({
  createIndexes: 'Errand',
  indexes: [{ key: { location: '2dsphere' }, name: 'errand_location_2dsphere' }],
});
```

## The actual problem: nearest-neighbor + recency, at scale

Two things need combining: **geographic proximity** and **recency** (`createdAt`, newer first).

**Recommended approach:**

1. **MongoDB's native `2dsphere` index**, set up per the gotcha above — `$geoNear` (aggregation stage) or `$near`/`$geoWithin` (query operators) let Mongo do the proximity filtering natively, rather than pulling every document into application memory and computing Haversine distance by hand.
2. **Filter to a bounding radius first** via `$geoNear`'s `maxDistance`, or `$geoWithin` — this uses the index to cheaply exclude everything far away.
3. **Rank the remaining (already small) candidate set** by a blended score, since "nearest" and "newest" trade off:
   ```
   score = w1 · proximityScore(distance) + w2 · recencyScore(ageInMinutes)
   ```
   Same shape as the composite trust score in `errand-reassignment-flow.md`.
4. **Top-K selection** — min-heap of size K. *(CLRS Ch. 6, Heaps; Ch. 9, Medians and Order Statistics.)*

**Honest gap in the reference material, unchanged from before**: geospatial indexing itself isn't a CLRS topic — the closest is Ch. 33 (Computational Geometry), loosely related at best. For understanding what's underneath `2dsphere` specifically, that's S2 geometry/geohashing territory (MongoDB's own docs, not an algorithms text).

## Sequence

1. Worker opens the discovery screen → `BrowseOpenErrandsQuery { requesterPartyId, categoryId?, radiusKm?, limit, cursor }`
2. Handler resolves worker's current location and active address's `state` (either their default `Address`, or a live GPS coordinate if the client sends one — `state` still comes from their registered address even if using live GPS, since GPS alone doesn't reliably give administrative-region boundaries)
3. Market, state, and tier filters applied (hard preconditions, cheap to check, applied before any geo work) — state filter is non-negotiable, never widened by `radiusKm`
4. Geospatial index query narrows to candidates within the resolved radius (explicit param → stored preference → state-boundary-only, per the precedence above)
5. Candidates scored (proximity + recency blend), top-K selected via the heap approach
6. Paginated result returned (`cursor` for the next page — since scores can shift as new errands are posted between page loads, cursor-based pagination here is "best effort," not perfectly stable; flagging as a known limitation rather than solving it now)

## Algorithmic component (summary)

- **Nearest-neighbor / geospatial filtering**: MongoDB's native `2dsphere` index (created outside Prisma's schema, per the gotcha above) — not a CLRS topic; practical answer is "use the database," not "implement it."
- **Composite ranking + top-K selection**: min-heap of size K — CLRS Ch. 6 (Heaps), Ch. 9 (Medians and Order Statistics).
- **State-boundary filtering**: plain exact-match query, no algorithm involved — deliberately not distance-based, see above.

## Open items

- Exact weighting (`w1`/`w2`) between proximity and recency — product decision, not yet made; should be config, not hardcoded.
- Whether an organization's discovery view aggregates by the org's registered base location, or by wherever its currently-active members happen to be — not yet decided.
