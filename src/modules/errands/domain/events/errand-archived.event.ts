import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';

interface ErrandArchivedPayload extends Record<string, unknown> {
  errandId: string;
}

export class ErrandArchivedEvent extends BaseDomainEvent<
  ErrandId,
  ErrandArchivedPayload
> {
  constructor(
    errandId: ErrandId,
    correlationId: string | undefined,
    payload: ErrandArchivedPayload,
  ) {
    super({
      aggregateId: errandId,
      correlationId,
      eventName: ErrandArchivedEvent.name,
      payload,
    });
  }
}
