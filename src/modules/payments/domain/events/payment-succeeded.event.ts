import { BaseDomainEvent, EntityId } from '@src/common';
import { ApplicationId } from '@module/application';
import { Money } from '@module/escrow';

interface PaymentSucceededPayload {
  gatewayReference: EntityId;
  purposeId: ApplicationId;
  amount: Money;
}

export class PaymentSucceeded extends BaseDomainEvent<
  EntityId,
  PaymentSucceededPayload
> {
  constructor(
    gatewayReference: EntityId,
    occurredAt: Date,
    correlationId: string,
    purposeId: ApplicationId,
    amount: Money,
  ) {
    super({
      aggregateId: gatewayReference,
      occurredAt,
      correlationId,
      eventName: PaymentSucceeded.name,
      payload: { gatewayReference, purposeId, amount },
    });
  }
}
