import { BaseDomainEvent } from '@src/common';
import { ChatThreadId } from '../value-objects';

interface ChatThreadClosedPayload extends Record<string, unknown> {
  threadId: string;
}

export class ChatThreadClosedEvent extends BaseDomainEvent<
  ChatThreadId,
  ChatThreadClosedPayload
> {
  constructor(
    threadId: ChatThreadId,
    correlationId: string | undefined,
    payload: ChatThreadClosedPayload,
  ) {
    super({
      aggregateId: threadId,
      correlationId,
      eventName: ChatThreadClosedEvent.name,
      payload,
    });
  }
}
