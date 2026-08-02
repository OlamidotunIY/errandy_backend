import { BaseDomainEvent, EntityId } from '@src/common';

interface PaymentRefundedPayload {
  paymentTransactionId: EntityId;
}

export class PaymentRefunded extends BaseDomainEvent<
  EntityId,
  PaymentRefundedPayload
> {
  constructor(
    paymentTransactionId: EntityId,
    occurredAt: Date,
    correlationId: string,
  ) {
    super({
      aggregateId: paymentTransactionId,
      occurredAt,
      correlationId,
      eventName: PaymentRefunded.name,
      payload: { paymentTransactionId },
    });
  }
}
