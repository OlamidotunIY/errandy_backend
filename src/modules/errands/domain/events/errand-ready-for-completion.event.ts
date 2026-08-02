import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';

interface ErrandReadyForCompletionPayload extends Record<string, unknown> {
  errandId: string;
}

export class ErrandReadyForCompletionEvent extends BaseDomainEvent<
  ErrandId,
  ErrandReadyForCompletionPayload
> {
  constructor(
    errandId: ErrandId,
    correlationId: string | undefined,
    payload: ErrandReadyForCompletionPayload,
  ) {
    super({
      aggregateId: errandId,
      correlationId,
      eventName: ErrandReadyForCompletionEvent.name,
      payload,
    });
  }
}
