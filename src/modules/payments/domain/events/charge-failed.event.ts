import { BaseDomainEvent } from '@src/common';
import { PaymentMethodId } from '../value-objects';

interface ChargeFailedPayload {
  purposeId: string;
  partyId: string;
  reason: string;
}

export class ChargeFailedEvent extends BaseDomainEvent<
  PaymentMethodId,
  ChargeFailedPayload
> {
  constructor(
    aggregateId: PaymentMethodId,
    occurredAt: Date,
    correlationId: string,
    payload: ChargeFailedPayload,
  ) {
    super({
      aggregateId,
      occurredAt,
      correlationId,
      eventName: ChargeFailedEvent.name,
      payload,
    });
  }
}
