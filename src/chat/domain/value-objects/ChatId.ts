import { EntityId } from '@shared';

class ChatId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ChatId {
    return new ChatId(crypto.randomUUID());
  }

  static fromString(value: string): ChatId {
    return new ChatId(value);
  }
}
export { ChatId };
