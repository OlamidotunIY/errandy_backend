import { BaseDomainEvent } from '@src/common';
import { PaymentMethodId } from '../value-objects';

interface ChargeRefundedPayload {
  gatewayReference: string;
  amountMinorUnits?: number;
}

export class ChargeRefundedEvent extends BaseDomainEvent<
  PaymentMethodId,
  ChargeRefundedPayload
> {
  constructor(
    aggregateId: PaymentMethodId,
    occurredAt: Date,
    correlationId: string,
    payload: ChargeRefundedPayload,
  ) {
    super({
      aggregateId,
      occurredAt,
      correlationId,
      eventName: ChargeRefundedEvent.name,
      payload,
    });
  }
}
