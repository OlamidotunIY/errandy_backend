import { EntityId } from './EntityId';

type DomainEventPayload = object;

interface DomainEvent<
  TId extends EntityId = EntityId,
  TPayload extends DomainEventPayload = DomainEventPayload,
> {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: TId;
  readonly eventName: string;
  readonly correlationId?: string;
  readonly payload: TPayload;
}

abstract class BaseDomainEvent<
  TId extends EntityId,
  TPayload extends DomainEventPayload = DomainEventPayload,
> implements DomainEvent<TId, TPayload> {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: TId;
  readonly eventName: string;
  readonly correlationId?: string;
  readonly payload: TPayload;

  protected constructor(params: {
    aggregateId: TId;
    eventName: string;
    payload: TPayload;
    occurredAt?: Date;
    correlationId?: string;
  }) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = params.occurredAt ?? new Date();
    this.aggregateId = params.aggregateId;
    this.eventName = params.eventName;
    this.correlationId = params.correlationId;
    this.payload = params.payload;
  }
}

export { BaseDomainEvent, DomainEvent, DomainEventPayload };
