import { DomainEvent, EntityId } from '@src/common';

export class PaymentRefunded implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly paymentTransactionId: EntityId,
    occurredAt: Date,
    correlationId: string,
  ) {
    this.eventName = PaymentRefunded.name;
    this.occurredAt = occurredAt;
    this.eventId = crypto.randomUUID();
    this.aggregateId = paymentTransactionId;
    this.correlationId = correlationId;
  }
}
