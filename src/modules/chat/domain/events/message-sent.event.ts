import { BaseDomainEvent } from '@src/common';
import { ChatMessageId } from '../value-objects';

interface MessageSentPayload extends Record<string, unknown> {
  threadId: string;
  senderId: string;
}

export class MessageSentEvent extends BaseDomainEvent<
  ChatMessageId,
  MessageSentPayload
> {
  constructor(
    messageId: ChatMessageId,
    correlationId: string | undefined,
    payload: MessageSentPayload,
  ) {
    super({
      aggregateId: messageId,
      correlationId,
      eventName: MessageSentEvent.name,
      payload,
    });
  }
}
