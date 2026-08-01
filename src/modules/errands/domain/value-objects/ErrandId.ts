import { EntityId } from '@src/common';

class ErrandId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ErrandId {
    return new ErrandId(crypto.randomUUID());
  }

  static fromString(value: string): ErrandId {
    return new ErrandId(value);
  }
}

export { ErrandId };
