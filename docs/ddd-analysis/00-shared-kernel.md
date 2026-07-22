# Shared Kernel: Domain Base Types

All bounded contexts should depend on a shared domain kernel package for identity and aggregate base abstractions.

Recommended location:

- `src/common/domain/`
- or `src/shared-kernel/domain/`

This keeps every module aligned on strongly-typed IDs and aggregate behavior while avoiding duplicated base classes.

## Implementation Spec

```typescript
/**
 * Base class for strongly-typed aggregate identifiers. Wrapping a raw string prevents
 * accidentally passing an EscrowId where a WalletId is expected - the compiler catches
 * it even though both are backed by a UUID string.
 */
abstract class EntityId {
  protected constructor(public readonly value: string) {}

  /** Returns true when both IDs represent the same identity value. */
  equals(other: EntityId): boolean;

  /** Returns the underlying persisted string value. */
  toString(): string;
}

/**
 * Contract for all domain events emitted by aggregates.
 * Events are immutable facts that happened in the domain and are published
 * after successful persistence.
 */
interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: EntityId;
  readonly eventName: string;
}

/**
 * Base class for all aggregate roots. TId is the aggregate's strongly-typed identifier
 * (e.g. EscrowId, WalletId) - never a bare string.
 */
abstract class AggregateRoot<TId extends EntityId> {
  readonly id: TId;

  protected constructor(id: TId);

  /** Records a domain event to be dispatched after successful persistence. */
  protected addDomainEvent(event: DomainEvent): void;

  /** Returns and clears pending domain events. Called by the repository after save(). */
  pullDomainEvents(): DomainEvent[];
}
```
