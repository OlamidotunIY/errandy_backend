import { EntityId } from '@src/common';

export class CategoryId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): CategoryId {
    return new CategoryId(crypto.randomUUID());
  }

  static fromString(value: string): CategoryId {
    return new CategoryId(value);
  }
}
