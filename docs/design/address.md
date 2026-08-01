# Module: address

## Folder placement

```
src/modules/address/
├── domain/
│   ├── entities/
│   │   └── address.entity.ts
│   ├── repositories/
│   │   └── address.repository.interface.ts
│   ├── events/
│   │   ├── address-created.event.ts
│   │   ├── address-updated.event.ts
│   │   └── default-address-changed.event.ts
│   └── errors/
│       └── address-not-found.error.ts
├── application/
│   ├── commands/
│   │   ├── create-address/
│   │   ├── update-address/
│   │   ├── set-default-address/
│   │   └── delete-address/
│   └── queries/
│       ├── get-address-by-id/
│       └── list-addresses-by-user/
├── infrastructure/
│   ├── adapters/
│   │   └── geocoding.adapter.ts
│   ├── mappers/
│   │   └── address.mapper.ts
│   └── repositories/
│       └── address.repository.ts
└── address.module.ts
```

## Prisma schema

Per the GeoJSON correction in `docs/flows/errand-discovery-flow.md`: `location` is stored as untyped `Json` holding a GeoJSON `Point`, since Prisma cannot express a first-class geo type or a real `2dsphere` index in schema language.

```prisma
model Address {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  ownerUserId String   @db.ObjectId
  label       String
  street      String
  city        String
  state       String
  country     String
  location    Json     // GeoJSON Point: { type: "Point", coordinates: [longitude, latitude] } — longitude first
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

No geospatial index is defined here directly — `Address` itself is rarely queried by proximity (that's `Errand.location`, denormalized at creation time). If a future feature needs "addresses near X," the same manual-index caveat applies: create it via `$runCommandRaw`, not `@@index`, and re-assert on every deploy.

## Domain entity methods

**`Address`**
- `create(ownerUserId, label, street, city, state, country, coordinates)` — static factory. `coordinates` is either passed directly (device GPS) or resolved via `GeocodingAdapter` from the text fields before this is called — the entity itself just stores the already-resolved GeoJSON shape, it doesn't know how to geocode.
- `update(label?, street?, city?, state?, country?, coordinates?)`
- `setDefault()` — the command handler (not this method) is responsible for un-setting any previous default for the same `ownerUserId`, since that's a cross-record invariant this single entity can't enforce on its own
- `toGeoJson()` — internal helper, `{ type: 'Point', coordinates: [longitude, latitude] }`

## Repository interface

```typescript
abstract class IAddressRepository {
  abstract save(address: Address): Promise<void>;
  abstract findById(id: string): Promise<Address | null>;
  abstract findByUserId(userId: string): Promise<Address[]>;
  abstract delete(id: string): Promise<void>;
}
```

## DTOs

```typescript
// commands/create-address/create-address.request.dto.ts
interface CreateAddressRequestDto {
  ownerUserId: string;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  coordinates?: { latitude: number; longitude: number };
  // if omitted, the handler calls GeocodingAdapter against street/city/state/country;
  // if provided (e.g. device GPS), geocoding is skipped entirely
}
interface CreateAddressResponseDto {
  addressId: string;
}

// commands/update-address/update-address.request.dto.ts
interface UpdateAddressRequestDto {
  addressId: string;
  label?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  coordinates?: { latitude: number; longitude: number };
}

// commands/set-default-address/set-default-address.request.dto.ts
interface SetDefaultAddressRequestDto {
  addressId: string;
  ownerUserId: string;
}

// commands/delete-address/delete-address.request.dto.ts
interface DeleteAddressRequestDto {
  addressId: string;
}

// queries/get-address-by-id/get-address-by-id.response.dto.ts
// queries/list-addresses-by-user/list-addresses-by-user.response.dto.ts (array of the same shape)
interface AddressResponseDto {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  coordinates: { latitude: number; longitude: number };   // converted back from GeoJSON's [lng, lat] at the DTO boundary — API consumers never have to deal with GeoJSON's inverted order directly
  isDefault: boolean;
}
```

## Open item

None carried forward for this module — it's intentionally kept simple (a supporting subdomain, not core), per the subdomain-classification principle from earlier in this project.
