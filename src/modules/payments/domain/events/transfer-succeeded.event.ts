import { BaseDomainEvent } from '@src/common';
import { PaymentTransactionId } from '../value-objects';

export interface TransferSucceededPayload {
  gatewayReference: string;
  metadata?: Record<string, unknown>;
}

export class TransferSucceededEvent extends BaseDomainEvent<
  PaymentTransactionId,
  TransferSucceededPayload
> {
  constructor(
    gatewayReference: string,
    correlationId: string,
    metadata?: Record<string, unknown>,
  ) {
    super({
      aggregateId: PaymentTransactionId.fromString(gatewayReference),
      correlationId,
      eventName: TransferSucceededEvent.name,
      payload: { gatewayReference, metadata },
    });
  }
}
