import { EntityId } from '@src/common';

class ChatMessageId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ChatMessageId {
    return new ChatMessageId(crypto.randomUUID());
  }

  static fromString(value: string): ChatMessageId {
    return new ChatMessageId(value);
  }
}

export { ChatMessageId };
