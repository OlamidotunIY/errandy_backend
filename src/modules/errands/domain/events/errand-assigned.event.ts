import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';

interface ErrandAssignedPayload extends Record<string, unknown> {
  errandId: string;
  acceptedApplicationId?: string;
}

export class ErrandAssignedEvent extends BaseDomainEvent<
  ErrandId,
  ErrandAssignedPayload
> {
  constructor(
    errandId: ErrandId,
    correlationId: string | undefined,
    payload: ErrandAssignedPayload,
  ) {
    super({
      aggregateId: errandId,
      correlationId,
      eventName: ErrandAssignedEvent.name,
      payload,
    });
  }
}
