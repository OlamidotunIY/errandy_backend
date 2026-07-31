import { DomainEvent, EntityId } from '@src/common';
import { ApplicationId } from '@module/application';

export class PaymentSucceeded implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly gatewayReference: EntityId,
    occurredAt: Date,
    correlationId: string,
    public readonly purposeId: ApplicationId,
    public readonly amountKobo: number,
  ) {
    this.eventName = PaymentSucceeded.name;
    this.occurredAt = occurredAt;
    this.eventId = crypto.randomUUID();
    this.aggregateId = gatewayReference;
    this.correlationId = correlationId;
  }
}
