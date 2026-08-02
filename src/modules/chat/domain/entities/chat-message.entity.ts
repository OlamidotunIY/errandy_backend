import { AggregateRoot } from '@src/common';
import { ChatMessageId } from '../value-objects';
import { MessageSentEvent } from '../events';

export class ChatMessage extends AggregateRoot<ChatMessageId> {
  constructor(
    public readonly id: ChatMessageId,
    public readonly threadId: string,
    public readonly senderId: string,
    public readonly content: string,
    public readonly sentAt: Date,
  ) {
    super(id);
  }

  static create(
    threadId: string,
    senderId: string,
    content: string,
    correlationId?: string,
  ): ChatMessage {
    const message = new ChatMessage(
      ChatMessageId.create(),
      threadId,
      senderId,
      content,
      new Date(),
    );

    message.addDomainEvent(
      new MessageSentEvent(message.id, correlationId, {
        threadId,
        senderId,
      }),
    );

    return message;
  }
}
