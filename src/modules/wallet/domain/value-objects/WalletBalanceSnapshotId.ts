import { EntityId } from '@shared';

export class WalletBalanceSnapshotId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): WalletBalanceSnapshotId {
    return new WalletBalanceSnapshotId(crypto.randomUUID());
  }

  static fromString(value: string): WalletBalanceSnapshotId {
    return new WalletBalanceSnapshotId(value);
  }
}
