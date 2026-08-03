# Module: service

## Folder placement

```
src/modules/service/
├── domain/
│   ├── entities/
│   │   └── service.entity.ts
│   ├── repositories/
│   │   └── service.repository.interface.ts
│   ├── events/
│   │   ├── service-listed.event.ts
│   │   └── service-deactivated.event.ts
│   └── errors/
│       ├── service-not-found.error.ts
│       └── service-not-owned-by-lister.error.ts
├── application/
│   ├── commands/
│   │   ├── list-service/           (tier/category gate check happens synchronously here, not via an event)
│   │   ├── update-service-price/
│   │   └── deactivate-service/
│   └── queries/
│       ├── search-services/
│       └── get-service-by-id/
├── infrastructure/
│   ├── mappers/
│   │   └── service.mapper.ts
│   └── repositories/
│       └── service.repository.ts
└── service.module.ts
```

## Prisma schema — introducing the shared `Money` composite type

`Money` is declared once, in the shared/root section of the Prisma schema, and reused by every module handling currency (`service`, `errands`, `application`, `payment-gateway`, `escrow`, `wallet`). It's a value object — always embedded, never independently queried — so a composite type is the right fit, same reasoning as `VerificationStep`.

```prisma
type Money {
  amountMinorUnits Int
  currency         String   // ISO 4217 — NGN, GHS, etc.
}

model Service {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  listedById  String   @db.ObjectId   // Party — plain scalar, no @relation (cross-module reference)
  categoryId  String   @db.ObjectId   // Category — plain scalar, must resolve to a leaf
  title       String
  description String
  price       Money
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Domain entity methods

**`Service`**
- `create(listedById, categoryId, title, description, price)` — static factory. Command handler checks `listerProviderRole.tier >= category.requiredTier` **before** calling this (a synchronous gate, not an event reaction — same pattern as the original verification gate)
- `updatePrice(newPrice: Money)`
- `deactivate()`

## Events

| Event | Raised by | Payload |
|---|---|---|
| `ServiceListed` | `Service.create()` | `{ serviceId, listedById, correlationId }` |
| `ServiceDeactivated` | `Service.deactivate()` | `{ serviceId, correlationId }` |

## Commands

| Command | Handler behavior |
|---|---|
| `ListServiceCommand` | Synchronous gate check: `listerProviderRole.tier >= category.requiredTier`, throws otherwise — not an event reaction. |
| `UpdateServicePriceCommand` | Ownership check: `ServiceNotOwnedByListerError` if `listedById` doesn't match the requester. |
| `DeactivateServiceCommand` | Same ownership check. |

## Event Handlers, Sagas, Jobs

None — the verification gate is synchronous, no reactive behavior needed.

## Repository interface

```typescript
abstract class IServiceRepository {
  abstract save(service: Service): Promise<void>;
  abstract findById(id: string): Promise<Service | null>;
  abstract findByListerId(listedById: string): Promise<Service[]>;
  abstract findActiveByCategory(categoryId: string, marketId: string): Promise<Service[]>;
}
```

## DTOs

```typescript
// commands/list-service/list-service.request.dto.ts
interface ListServiceRequestDto {
  listedById: string;
  categoryId: string;
  title: string;
  description: string;
  price: { amountMinorUnits: number; currency: string };
}
interface ListServiceResponseDto {
  serviceId: string;
}

// commands/update-service-price/update-service-price.request.dto.ts
interface UpdateServicePriceRequestDto {
  serviceId: string;
  price: { amountMinorUnits: number; currency: string };
}

// commands/deactivate-service/deactivate-service.request.dto.ts
interface DeactivateServiceRequestDto {
  serviceId: string;
}

// queries/search-services/search-services.request.dto.ts
interface SearchServicesRequestDto {
  categoryId?: string;
  marketId: string;
  limit: number;
  cursor?: string;
}
// queries/search-services/search-services.response.dto.ts (also used by get-service-by-id)
interface ServiceResponseDto {
  id: string;
  listedById: string;
  categoryId: string;
  title: string;
  description: string;
  price: { amountMinorUnits: number; currency: string };
}
```

## Mappers

`ServiceMapper`
- `toDomain(prismaService)` / `toPersistence(service)` — includes `Money` ↔ Prisma `Money` composite-type conversion via `Money.fromJSON()`/`.toJSON()`

## Presentation

```graphql
type Mutation {
  listService(input: ListServiceInput!): Service! @auth
  updateServicePrice(input: UpdateServicePriceInput!): Service! @auth
  deactivateService(serviceId: ID!): Boolean! @auth
}
type Query {
  searchServices(categoryId: ID, marketId: ID!, limit: Int!, cursor: String): [Service!]!
  service(id: ID!): Service
}
```

## Open items

None carried forward.
