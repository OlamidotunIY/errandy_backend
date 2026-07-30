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
    private readonly _activeKobo: number,
    private readonly _pendingKobo: number,
    private readonly _availableKobo: number,
    private readonly _lastSequence: number,
    private readonly _updatedAt: Date,
  ) {
    super(_id);
  }

  static reconstitute(
    id: WalletBalanceSnapshotId,
    walletId: WalletId,
    activekobo: number,
    pendingKobo: number,
    availableKobo: number,
    lastSequence: number,
    updatedAt: Date,
  ): WalletBalanceSnapshot {
    return new WalletBalanceSnapshot(
      id,
      walletId,
      activekobo,
      pendingKobo,
      availableKobo,
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
      calculatedBalances.activeKobo,
      calculatedBalances.pendingKobo,
      calculatedBalances.availableKobo,
      lastSequence,
      new Date(),
    );
  }

  apply(
    entries: LedgerEntry[],
    walletId: WalletId,
    id: WalletBalanceSnapshotId,
  ): WalletBalanceSnapshot {
    let activekobo = 0;
    let pendingkobo = 0;
    let availablekobo = 0;

    for (const entry of entries) {
      switch (entry.type) {
        case LedgerEntryType.ACTIVE_ERRAND_CREDIT:
          activekobo += entry.amountKobo;
          break;
        case LedgerEntryType.ACTIVE_ERRAND_REVERSAL:
          activekobo -= entry.amountKobo;
          break;
        case LedgerEntryType.PENDING_CREDIT:
          pendingkobo += entry.amountKobo;
          break;
        case LedgerEntryType.PENDING_REVERSAL:
          pendingkobo -= entry.amountKobo;
          break;
        case LedgerEntryType.AVAILABLE_CREDIT:
          availablekobo += entry.amountKobo;
          break;
        case LedgerEntryType.WITHDRAWAL_DEBIT:
          availablekobo -= entry.amountKobo;
          break;
      }
    }

    return new WalletBalanceSnapshot(
      id,
      walletId,
      this._activeKobo + activekobo,
      this._pendingKobo + pendingkobo,
      this._availableKobo + availablekobo,
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

  get activeKobo(): number {
    return this._activeKobo;
  }

  get pendingKobo(): number {
    return this._pendingKobo;
  }

  get availableKobo(): number {
    return this._availableKobo;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}

export { WalletBalanceSnapshot };
