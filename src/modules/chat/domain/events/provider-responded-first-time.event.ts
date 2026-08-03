import { BaseDomainEvent } from '@src/common';
import { ChatThreadId } from '../value-objects';

interface ProviderRespondedFirstTimePayload extends Record<string, unknown> {
  threadId: string;
  providerPartyId: string;
  responseTimeSeconds: number;
}

export class ProviderRespondedFirstTimeEvent extends BaseDomainEvent<
  ChatThreadId,
  ProviderRespondedFirstTimePayload
> {
  constructor(
    threadId: ChatThreadId,
    correlationId: string | undefined,
    payload: ProviderRespondedFirstTimePayload,
  ) {
    super({
      aggregateId: threadId,
      correlationId,
      eventName: ProviderRespondedFirstTimeEvent.name,
      payload,
    });
  }
}
