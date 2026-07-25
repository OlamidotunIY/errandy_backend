import { EntityId } from './EntityId';

interface DomainEvent<TId extends EntityId = EntityId> {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: TId;
  readonly eventName: string;
  readonly correlationId?: string;
}

export { DomainEvent };
