# Address — DDD & EIP Analysis

## 1. Current Responsibility

Manages address autocomplete and geocoding via Google Places API:

- **Address suggestions**: `suggestAddresses` (line 20-31) fetches autocomplete suggestions from Google Places.
- **Reverse geocoding**: `reverseGeocode` (line 33-68) converts coordinates to formatted address (fallback: "Pinned Location").
- **Place details**: `getPlaceDetails` (line 73-86) fetches full address details from Google Place ID.
- **User addresses**: `getUserAddresses` (line 88-98) fetches user's saved addresses from DB.

**Files**: `address.service.ts` (~98 lines), `address.resolver.ts`, `address.module.ts`.

## 2. Bounded Context Assessment

**This is infrastructure** (Google Places adapter) + **sub-domain of Users**.

- Address autocomplete/geocoding is **infrastructure** — wrapper for Google Places API.
- User addresses (`getUserAddresses`) is **domain logic** — belongs to Users module.

**Overlaps**:

- **Users**: User has `activeAddressId` (foreign key to `UserAddress`).
- **Errands**: Errand has `location` (coordinates) for geospatial search.
- **Provider**: Provider has `activeAddress` for location-based matching.

**Verdict**: Split Address module:

1. **Infrastructure layer**: Google Places adapter (autocomplete, geocoding) → `common/geocoding/`.
2. **Domain layer**: User address management → merge into **Users** module.

## 3. Domain Model Audit

**Anemic models**:

- `UserAddress` (Prisma model) is a data bag with `formattedAddress`, `location` (GeoPoint), `label`.
  - No behavior: No `UserAddress.setAsActive()`, `UserAddress.validate()` methods.

**Aggregate boundaries**:

- **`User`** aggregate should own `UserAddress` (child entity):
  - Invariants: Active address must exist, user must have at least one address to post errands.

**Invariants currently unenforced**:

1. **Active address validation**:
   - Users module deletes address without checking if it's active (dangling `activeAddressId` bug) — URGENT fix needed.
2. **Address uniqueness**:
   - No validation that user doesn't save duplicate addresses (same `formattedAddress`).

## 4. Layering Violations

**Infrastructure in service**:

- `suggestAddresses` (line 20-31) makes direct HTTP call to Google Places API (`axios.get`) — should be in infrastructure adapter.
- `reverseGeocode` (line 33-68) makes direct HTTP call to Google Places API — should be in infrastructure adapter.

**Domain logic missing**:

- `getUserAddresses` (line 88-98) is a read operation (query) — fine.
- However, address creation/deletion logic is likely in resolver or Users module (not in Address service).

## 5. Repository Pattern Gap

**Current state**: Direct Prisma usage for `getUserAddresses`.

**Proposed**:

```
infrastructure/geocoding/
  IGeocodingService (interface - port)
    - suggestAddresses(input): AddressSuggestion[]
    - reverseGeocode(lat, lng): AddressDetails
    - getPlaceDetails(placeId): AddressDetails
  GooglePlacesAdapter (implementation)
```

**User address repository** (in Users module):

```
domain/
  IUserAddressRepository (interface)
    - findByUserId(userId): UserAddress[]
    - save(address): void
```

## 6. EIP Opportunities

**Adapter Pattern** (should be implemented):

- Current: `AddressService` is tightly coupled to Google Places API (line 20-86: axios calls).
- Recommendation: Extract `IGeocodingService` interface:
  - `GooglePlacesAdapter` implements interface.
  - `MapboxAdapter` as alternative (if switching providers).

**Dead Letter / Retry**:

- Google Places API calls can fail (timeout, rate limit).
  - No retry — user sees error and must retry manually.
  - Recommendation: Add retry logic (3x with exponential backoff).

**Fallback**:

- `reverseGeocode` (line 33-68) has fallback to "Pinned Location" (line 52-55, line 61-67) — good resilience pattern.

## 7. Cross-Cutting Concerns

**Error handling**:

- `reverseGeocode` (line 58-67) catches errors and returns fallback — good.
- `suggestAddresses` and `getPlaceDetails` don't catch errors — axios errors bubble up.

**Logging**:

- `reverseGeocode` (line 60) logs errors — good.
- Other methods don't log — should log API calls for audit trail.

**Validation**:

- No validation of coordinates (latitude: -90 to 90, longitude: -180 to 180).

## 8. GraphQL-Specific Notes

**Authorization**:

- `suggestAddresses`, `reverseGeocode`, `getPlaceDetails` are public (no auth needed for autocomplete).
- `getUserAddresses` requires auth (user can only view their own addresses).

## 9. Target Structure

```
src/infrastructure/geocoding/  # OR src/common/geocoding/
  domain/
    IGeocodingService.ts            # Port (interface)

  infrastructure/
    adapters/
      GooglePlacesAdapter.ts        # Adapter (implements IGeocodingService)
      MapboxAdapter.ts              # Future: Mapbox support

  presentation/
    resolvers/
      GeocodingResolver.ts          # Autocomplete, reverse geocoding

src/users/
  domain/
    entities/
      UserAddress.ts                # Child entity of User aggregate
    repositories/
      IUserAddressRepository.ts

  application/
    queries/
      GetUserAddresses/
        GetUserAddressesQuery.ts
        GetUserAddressesHandler.ts
```

## Persistence Model (Derived from Domain)

```prisma
model UserAddress {
  id String @id @map("_id")
  userId String
  label String
  address String
  location Json
  createdAt DateTime
  updatedAt DateTime

  @@index([userId, createdAt]) // serves: findByUserId
}
```

`location` embeds the coordinate value object. Reference fields are scalar IDs only: `userId`. Cleanup owners: `UserDeletedPolicyHandler` deletes or archives addresses through `IUserAddressRepository`; `DeleteUserAddressCommandHandler` must emit/perform active-address cleanup in Users before deleting an address. `id` serves `findById`, and the user/date index serves `findByUserId`. No unique constraint is added because users may save multiple addresses with the same label or coordinates unless product rules change.

---

## 10. Migration Risk & Priority

**Risk**: **MEDIUM**

- Address module is split between infrastructure (geocoding) and domain (user addresses) — refactoring requires coordination.
- Google Places API is external dependency — changing adapter could break autocomplete.

**Priority**: **PHASE 2 (parallel with Users)**
**Rationale**:

1. User addresses are tightly coupled to Users module — refactor together.
2. Geocoding infrastructure can be extracted independently (low coupling).
3. Active address bug (in Users module) must be fixed first.

**Migration steps**:

1. **Extract IGeocodingService interface** (port).
2. **Rename AddressService to GooglePlacesAdapter** (adapter).
3. **Move user address logic to Users module** (merge `getUserAddresses` into Users domain).
4. **Fix active address bug** in Users module (URGENT).
5. **Add retry logic** for Google Places API calls (3x with exponential backoff).
6. **Add coordinate validation** (latitude/longitude ranges).
7. **Add DataLoader** for user addresses (prevent N+1 if needed).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Value object representing a user address consumed by Users and Errands contexts.
 * Maps to schema fields on UserAddress: id, userId, label, address, location, createdAt, updatedAt.
 */
class AddressId extends EntityId {
  /**
   * Private constructor. Use AddressId.new() or AddressId.from().
   */
  private constructor(value: string);

  /**
   * Creates a new AddressId.
   */
  static new(): AddressId;

  /**
   * Rehydrates AddressId from persisted value.
   */
  static from(value: string): AddressId;
}

/**
 * Snapshot of address values used by application and query layers.
 */
class UserAddressSnapshot {
  constructor(
    public readonly id: AddressId,
    public readonly userId: UserId,
    public readonly label: string,
    public readonly address: string,
    public readonly location: { type: "Point"; coordinates: [number, number] },
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  );

  /**
   * Validates coordinate boundaries before issuing geocoding lookups.
   * Latitude must be in [-90, 90], longitude in [-180, 180].
   */
  validateCoordinates(): void;
}

/**
 * Port for external geocoding providers.
 */
interface IGeocodingService {
  /**
   * Resolves free-text input to candidate addresses.
   */
  suggestAddresses(input: string): Promise<Array<{ placeId: string; description: string }>>;

  /**
   * Resolves coordinates to a formatted address.
   */
  reverseGeocode(lat: number, lng: number): Promise<{ formattedAddress: string; placeId?: string }>;

  /**
   * Resolves provider-specific place id to full address details.
   */
  getPlaceDetails(placeId: string): Promise<{ formattedAddress: string; location: { type: "Point"; coordinates: [number, number] } }>;
}
```

### Repository Interface

```typescript
/**
 * Read/write contract for persisted user addresses (UserAddress model).
 */
interface IUserAddressRepository {
  /**
   * Returns all addresses owned by a user, ordered by createdAt descending.
   */
  findByUserId(userId: UserId): Promise<UserAddressSnapshot[]>;

  /**
   * Finds one address by UserAddress.id.
   */
  findById(id: AddressId): Promise<UserAddressSnapshot | null>;

  /**
   * Persists address updates for fields label, address, location, and updatedAt.
   */
  save(address: UserAddressSnapshot): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Query handler for geocoding autocomplete requests.
 */
class SuggestAddressesQueryHandler {
  /**
   * @param query Contains partial address input
   * @returns Place suggestions for UI autocomplete
   */
  execute(
    query: SuggestAddressesQuery,
  ): Promise<Array<{ placeId: string; description: string }>>;
}

interface SuggestAddressesQuery {
  input: string;
}

/**
 * Query handler for a user's saved addresses.
 */
class GetUserAddressesQueryHandler {
  /**
   * Reads UserAddress records by userId and returns normalized snapshots.
   */
  execute(query: GetUserAddressesQuery): Promise<UserAddressSnapshot[]>;
}

interface GetUserAddressesQuery {
  userId: UserId;
}
```

### Domain Events

```typescript
/**
 * Emitted when autocomplete suggestions are returned from geocoding adapter.
 */
class AddressSuggestionsResolvedEvent {
  constructor(
    public readonly userId: UserId | null,
    public readonly input: string,
    public readonly suggestionCount: number,
  );
}

/**
 * Emitted when reverse geocoding resolves a coordinate pair.
 */
class ReverseGeocodeResolvedEvent {
  constructor(
    public readonly lat: number,
    public readonly lng: number,
    public readonly formattedAddress: string,
  );
}
```
