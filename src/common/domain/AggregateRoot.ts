import { DomainEvent } from './';
import { EntityId } from './EntityId';

abstract class AggregateRoot<T extends EntityId> {
  readonly id: T;
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: T) {
    this.id = id;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }
}

export { AggregateRoot };
