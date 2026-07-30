import { EntityId } from '@src/common';

class UserId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): UserId {
    return new UserId(crypto.randomUUID());
  }

  static fromString(value: string): UserId {
    return new UserId(value);
  }
}

export { UserId };
