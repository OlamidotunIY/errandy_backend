import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';

interface ErrandPublishedPayload extends Record<string, unknown> {
  errandId: string;
}

export class ErrandPublishedEvent extends BaseDomainEvent<
  ErrandId,
  ErrandPublishedPayload
> {
  constructor(
    errandId: ErrandId,
    correlationId: string | undefined,
    payload: ErrandPublishedPayload,
  ) {
    super({
      aggregateId: errandId,
      correlationId,
      eventName: ErrandPublishedEvent.name,
      payload,
    });
  }
}
