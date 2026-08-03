import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';
import { SourceType } from '../value-objects';

interface ErrandCreatedPayload extends Record<string, unknown> {
  errandId: string;
  clientPartyId: string;
  sourceType: SourceType;
}

export class ErrandCreatedEvent extends BaseDomainEvent<
  ErrandId,
  ErrandCreatedPayload
> {
  constructor(
    errandId: ErrandId,
    correlationId: string | undefined,
    payload: ErrandCreatedPayload,
  ) {
    super({
      aggregateId: errandId,
      correlationId,
      eventName: ErrandCreatedEvent.name,
      payload,
    });
  }
}
