import { BaseDomainEvent } from '@src/common';
import { PaymentMethodId } from '../value-objects';

interface ChargeSucceededPayload {
  gatewayReference: string;
  purposeId: string;
  partyId: string;
  amountMinorUnits: number;
  currency: string;
}

export class ChargeSucceededEvent extends BaseDomainEvent<
  PaymentMethodId,
  ChargeSucceededPayload
> {
  constructor(
    aggregateId: PaymentMethodId,
    occurredAt: Date,
    correlationId: string,
    payload: ChargeSucceededPayload,
  ) {
    super({
      aggregateId,
      occurredAt,
      correlationId,
      eventName: ChargeSucceededEvent.name,
      payload,
    });
  }
}
