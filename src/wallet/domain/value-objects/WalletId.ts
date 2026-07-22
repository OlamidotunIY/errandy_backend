import { EntityId } from '@shared';

class WalletId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): WalletId {
    return new WalletId(crypto.randomUUID());
  }

  static fromString(value: string): WalletId {
    return new WalletId(value);
  }
}

export { WalletId };
