import { BaseDomainEvent } from '@src/common';
import { PaymentTransactionId } from '../value-objects';

export interface TransferFailedPayload {
  gatewayReference: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export class TransferFailedEvent extends BaseDomainEvent<
  PaymentTransactionId,
  TransferFailedPayload
> {
  constructor(
    gatewayReference: string,
    reason: string,
    correlationId: string,
    metadata?: Record<string, unknown>,
  ) {
    super({
      aggregateId: PaymentTransactionId.fromString(gatewayReference),
      correlationId,
      eventName: TransferFailedEvent.name,
      payload: { gatewayReference, reason, metadata },
    });
  }
}
