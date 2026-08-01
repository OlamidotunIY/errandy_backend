import { ApplicationId } from '@module/application';
import { BaseDomainEvent, EntityId } from '@src/common';

interface PaymentFailedPayload {
  gatewayReference: EntityId;
  purposeId: ApplicationId;
  reason: string;
}

export class PaymentFailed extends BaseDomainEvent<EntityId, PaymentFailedPayload> {
  constructor(
    gatewayReference: EntityId,
    occurredAt: Date,
    correlationId: string,
    purposeId: ApplicationId,
    reason: string,
  ) {
    super({
      aggregateId: gatewayReference,
      occurredAt,
      correlationId,
      eventName: PaymentFailed.name,
      payload: { gatewayReference, purposeId, reason },
    });
  }
}
