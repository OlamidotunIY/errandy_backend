import { EntityId } from '@src/common';

export class MarketId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): MarketId {
    return new MarketId(crypto.randomUUID());
  }

  static fromString(value: string): MarketId {
    return new MarketId(value);
  }
}
