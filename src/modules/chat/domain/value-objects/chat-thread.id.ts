import { EntityId } from '@src/common';

class ChatThreadId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ChatThreadId {
    return new ChatThreadId(crypto.randomUUID());
  }

  static fromString(value: string): ChatThreadId {
    return new ChatThreadId(value);
  }
}

export { ChatThreadId };
