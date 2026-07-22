import { DomainEvent } from './DomainEvent';
import { EntityId } from './EntityId';

abstract class AggregateRoot<T extends EntityId> {
  readonly id: T;

  protected constructor(id: T) {
    this.id = id;
  }

  protected addDomainEvent(event: DomainEvent): void {
    // Implementation for adding a domain event to the aggregate root
  }

  protected pullDomainEvents(): DomainEvent[] {
    // Implementation for retrieving and clearing domain events from the aggregate root
    return [];
  }
}

export { AggregateRoot };
