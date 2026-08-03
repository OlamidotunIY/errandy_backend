import {
  LedgerBalanceCalculator,
  LedgerEntry,
  LedgerEntryType,
  WalletBalanceSnapshotId,
  WalletId,
} from 'src/modules/wallet/domain';
import { Currency } from 'src/modules/escrow';
import { AggregateRoot } from '@src/common';
import * as crypto from 'node:crypto';

class WalletBalanceSnapshot extends AggregateRoot<WalletBalanceSnapshotId> {
  constructor(
    private readonly _id: WalletBalanceSnapshotId,
    private readonly _walletId: WalletId,
    private readonly _activeMinorUnits: number,
    private readonly _pendingMinorUnits: number,
    private readonly _availableMinorUnits: number,
    private readonly _lastSequence: number,
    private readonly _updatedAt: Date,
  ) {
    super(_id);
  }

  static reconstitute(
    id: WalletBalanceSnapshotId,
    walletId: WalletId,
    activeMinorUnits: number,
    pendingMinorUnits: number,
    availableMinorUnits: number,
    lastSequence: number,
    updatedAt: Date,
  ): WalletBalanceSnapshot {
    return new WalletBalanceSnapshot(
      id,
      walletId,
      activeMinorUnits,
      pendingMinorUnits,
      availableMinorUnits,
      lastSequence,
      updatedAt,
    );
  }

  static create(walletId: WalletId): WalletBalanceSnapshot {
    return new WalletBalanceSnapshot(
      new WalletBalanceSnapshotId(crypto.randomUUID()),
      walletId,
      0,
      0,
      0,
      0,
      new Date(),
    );
  }

  static fromLedger(
    walletId: WalletId,
    entries: LedgerEntry[],
    id: WalletBalanceSnapshotId,
    currency: Currency,
  ): WalletBalanceSnapshot {
    const calculator = new LedgerBalanceCalculator();
    const calculatedBalances = calculator.calculate(entries, currency);

    const lastSequence =
      entries.length === 0
        ? 0
        : Math.max(...entries.map((entry) => entry.sequence as number));

    return new WalletBalanceSnapshot(
      id,
      walletId,
      calculatedBalances.activeMinorUnits,
      calculatedBalances.pendingMinorUnits,
      calculatedBalances.availableMinorUnits,
      lastSequence,
      new Date(),
    );
  }

  apply(
    entries: LedgerEntry[],
    walletId: WalletId,
    id: WalletBalanceSnapshotId,
  ): WalletBalanceSnapshot {
    let activeMinorUnits = 0;
    let pendingMinorUnits = 0;
    let availableMinorUnits = 0;

    for (const entry of entries) {
      switch (entry.type) {
        case LedgerEntryType.ACTIVE_ERRAND_CREDIT:
          activeMinorUnits += entry.toMinorUnits();
          break;
        case LedgerEntryType.ACTIVE_ERRAND_REVERSAL:
          activeMinorUnits -= entry.toMinorUnits();
          break;
        case LedgerEntryType.PENDING_CREDIT:
          pendingMinorUnits += entry.toMinorUnits();
          break;
        case LedgerEntryType.PENDING_REVERSAL:
          pendingMinorUnits -= entry.toMinorUnits();
          break;
        case LedgerEntryType.AVAILABLE_CREDIT:
          availableMinorUnits += entry.toMinorUnits();
          break;
        case LedgerEntryType.WITHDRAWAL_DEBIT:
          availableMinorUnits -= entry.toMinorUnits();
          break;
      }
    }

    return new WalletBalanceSnapshot(
      id,
      walletId,
      this._activeMinorUnits + activeMinorUnits,
      this._pendingMinorUnits + pendingMinorUnits,
      this._availableMinorUnits + availableMinorUnits,
      this._lastSequence,
      new Date(),
    );
  }

  get lastSequence(): number {
    return this._lastSequence;
  }

  get walletId(): WalletId {
    return this._walletId;
  }

  get activeMinorUnits(): number {
    return this._activeMinorUnits;
  }

  get pendingMinorUnits(): number {
    return this._pendingMinorUnits;
  }

  get availableMinorUnits(): number {
    return this._availableMinorUnits;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}

export { WalletBalanceSnapshot };
