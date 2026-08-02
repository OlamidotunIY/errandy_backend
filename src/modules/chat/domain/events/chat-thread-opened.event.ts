import { BaseDomainEvent } from '@src/common';
import { ChatThreadId } from '../value-objects';

interface ChatThreadOpenedPayload extends Record<string, unknown> {
  threadId: string;
  errandId: string;
}

export class ChatThreadOpenedEvent extends BaseDomainEvent<
  ChatThreadId,
  ChatThreadOpenedPayload
> {
  constructor(
    threadId: ChatThreadId,
    correlationId: string | undefined,
    payload: ChatThreadOpenedPayload,
  ) {
    super({
      aggregateId: threadId,
      correlationId,
      eventName: ChatThreadOpenedEvent.name,
      payload,
    });
  }
}
