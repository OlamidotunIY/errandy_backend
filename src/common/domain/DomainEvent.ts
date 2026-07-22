abstract class DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: EntityId;
  readonly eventName: string;

  protected constructor(
    eventId: string,
    occurredAt: Date,
    aggregateId: EntityId,
    eventName: string,
  ) {
    this.eventId = eventId;
    this.occurredAt = occurredAt;
    this.aggregateId = aggregateId;
    this.eventName = eventName;
  }
}