import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';

interface ErrandStartedPayload extends Record<string, unknown> {
  errandId: string;
}

export class ErrandStartedEvent extends BaseDomainEvent<
  ErrandId,
  ErrandStartedPayload
> {
  constructor(
    errandId: ErrandId,
    correlationId: string | undefined,
    payload: ErrandStartedPayload,
  ) {
    super({
      aggregateId: errandId,
      correlationId,
      eventName: ErrandStartedEvent.name,
      payload,
    });
  }
}
