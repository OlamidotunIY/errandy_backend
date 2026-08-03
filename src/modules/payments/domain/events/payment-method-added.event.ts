import { BaseDomainEvent } from '@src/common';
import { PaymentMethod, PaymentMethodId } from '..';

interface PaymentMethodAddedPayload {
  partyId: string;
  provider: string;
  type: string;
}

export class PaymentMethodAddedEvent extends BaseDomainEvent<
  PaymentMethodId,
  PaymentMethodAddedPayload
> {
  constructor(
    aggregateId: PaymentMethodId,
    occurredAt: Date,
    correlationId: string,
    payload: PaymentMethodAddedPayload,
  ) {
    super({
      aggregateId,
      occurredAt,
      correlationId,
      eventName: PaymentMethodAddedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    method: PaymentMethod,
    correlationId: string,
  ): PaymentMethodAddedEvent {
    return new PaymentMethodAddedEvent(method.id, new Date(), correlationId, {
      partyId: method.partyId,
      provider: method.provider,
      type: method.type,
    });
  }
}
