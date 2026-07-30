import { EntityId } from '@src/common';

class LedgerEntryId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): LedgerEntryId {
    return new LedgerEntryId(crypto.randomUUID());
  }

  static fromString(value: string): LedgerEntryId {
    return new LedgerEntryId(value);
  }
}

export { LedgerEntryId };
