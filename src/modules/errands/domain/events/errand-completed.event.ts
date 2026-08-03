import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';
import { CompletedBy } from '../value-objects';

interface ErrandCompletedPayload extends Record<string, unknown> {
  errandId: string;
  completedBy: CompletedBy;
}

export class ErrandCompletedEvent extends BaseDomainEvent<
  ErrandId,
  ErrandCompletedPayload
> {
  declare readonly correlationId: string;

  constructor(
    errandId: ErrandId,
    correlationId: string,
    payload: ErrandCompletedPayload,
  ) {
    super({
      aggregateId: errandId,
      correlationId,
      eventName: ErrandCompletedEvent.name,
      payload,
    });
  }
}
