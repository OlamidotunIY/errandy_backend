import { LedgerEntryType, WalletId } from '..';
import { Currency, CurrencyMismatchError, EscrowId } from 'src/modules/escrow';
import { LedgerEntry } from './LedgerEntry';
import {
  InsufficientActiveBalanceError,
  InsufficientAvailableBalanceError,
  InsufficientPendingBalanceError,
} from '../errors';
import {
  ActiveErrandCredited,
  ActiveErrandReversed,
  ClientRefunded,
  MovedToPending,
  ReleasedToAvailable,
  WithdrawalRecorded,
} from '../events';
import { UserId } from '@src/users';
import { AggregateRoot } from '@src/common';

class Wallet extends AggregateRoot<WalletId> {
  private constructor(
    public readonly id: WalletId,
    public readonly userId: UserId,
    public readonly currency: Currency,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(userId: UserId, currency: Currency): Wallet {
    if (!userId) {
      throw new Error('UserId is required to create a wallet');
    }
    if (!currency) {
      throw new Error('Currency is required to create a wallet');
    }
    const now = new Date();
    return new Wallet(
      new WalletId(crypto.randomUUID()),
      userId,
      currency,
      now,
      now,
    );
  }

  static reconstitute(
    id: WalletId,
    userId: UserId,
    currency: Currency,
    createdAt: Date,
    updatedAt: Date,
  ): Wallet {
    return new Wallet(id, userId, currency, createdAt, updatedAt);
  }

  recordActiveErrandCredit(
    amountKobo: number,
    currency: Currency,
    escrowId: EscrowId,
    gatewayReference: string,
    correlationId: string,
  ): LedgerEntry {
    const idempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_CREDIT}_${escrowId.toString()}`;
    const entries = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.ACTIVE_ERRAND_CREDIT,
      amountKobo,
      currency,
      escrowId,
      gatewayReference,
      idempotencyKey,
    });

    this.addDomainEvent(
      ActiveErrandCredited.fromAggregate(this, escrowId, correlationId),
    );

    return entries;
  }

  moveActiveToPending(
    amountKobo: number,
    currency: Currency,
    escrowId: EscrowId,
    computedActiveBalanceKobo: number,
    correlationId: string,
  ): LedgerEntry[] {
    if (computedActiveBalanceKobo < amountKobo) {
      throw new InsufficientActiveBalanceError(
        `Insufficient active balance to move ${amountKobo} kobo to pending`,
      );
    }
    const debitIdempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_REVERSAL}_${escrowId.toString()}`;
    const creditIdempotencyKey = `${LedgerEntryType.PENDING_CREDIT}_${escrowId.toString()}`;
    const debitEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.ACTIVE_ERRAND_REVERSAL,
      amountKobo,
      currency,
      escrowId,
      gatewayReference: null,
      idempotencyKey: debitIdempotencyKey,
    });
    const creditEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.PENDING_CREDIT,
      amountKobo,
      currency,
      escrowId,
      gatewayReference: null,
      idempotencyKey: creditIdempotencyKey,
    });

    this.addDomainEvent(
      MovedToPending.fromAggregate(this, escrowId, correlationId),
    );

    return [debitEntry, creditEntry];
  }

  moveToAvailable(
    amountKobo: number,
    currency: Currency,
    escrowId: EscrowId,
    computedPendingBalanceKobo: number,
    correlationId: string,
  ): LedgerEntry[] {
    if (computedPendingBalanceKobo < amountKobo) {
      throw new InsufficientPendingBalanceError(
        `Insufficient pending balance to move ${amountKobo} kobo to available`,
      );
    }

    const debitIdempotencyKey = `${LedgerEntryType.PENDING_REVERSAL}_${escrowId.toString()}`;
    const creditIdempotencyKey = `${LedgerEntryType.AVAILABLE_CREDIT}_${escrowId.toString()}`;

    const creditEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.AVAILABLE_CREDIT,
      amountKobo,
      currency,
      escrowId,
      gatewayReference: null,
      idempotencyKey: creditIdempotencyKey,
    });

    const debitEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.PENDING_REVERSAL,
      amountKobo,
      currency,
      escrowId,
      gatewayReference: null,
      idempotencyKey: debitIdempotencyKey,
    });

    this.addDomainEvent(
      ReleasedToAvailable.fromAggregate(this, escrowId, correlationId),
    );

    return [debitEntry, creditEntry];
  }

  recordWithdrawal(
    amountKobo: number,
    currency: Currency,
    gatewayReference: string,
    computedAvailableBalanceKobo: number,
    correlationId: string,
  ): LedgerEntry {
    if (computedAvailableBalanceKobo < amountKobo) {
      throw new InsufficientAvailableBalanceError(
        `Insufficient available balance to record withdrawal of ${amountKobo} kobo`,
      );
    }

    const idempotencyKey = `${LedgerEntryType.WITHDRAWAL_DEBIT}_${gatewayReference}`;

    const entry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.WITHDRAWAL_DEBIT,
      amountKobo,
      currency,
      escrowId: null,
      gatewayReference,
      idempotencyKey,
    });

    this.addDomainEvent(
      WithdrawalRecorded.fromAggregate(this, gatewayReference, correlationId),
    );

    return entry;
  }

  recordActiveErrandReversal(
    amountKobo: number,
    currency: Currency,
    escrowId: EscrowId,
    gatewayReference: string,
    computedActiveBalanceKobo: number,
    correlationId: string,
  ): LedgerEntry {
    if (computedActiveBalanceKobo < amountKobo) {
      throw new InsufficientActiveBalanceError(
        `Insufficient active balance to record reversal of ${amountKobo} kobo`,
      );
    }

    const debitIdempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_REVERSAL}_${escrowId.toString()}`;
    // const creditIdempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_CREDIT}_${escrowId.toString()}`;
    const entry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.ACTIVE_ERRAND_REVERSAL,
      amountKobo,
      currency,
      escrowId,
      gatewayReference,
      idempotencyKey: debitIdempotencyKey,
    });
    this.addDomainEvent(
      ActiveErrandReversed.fromAggregate(this, escrowId, correlationId),
    );
    return entry;
  }

  recordClientRefund(
    amountKobo: number,
    currency: Currency,
    escrowId: EscrowId,
    gatewayReference: string,
    correlationId: string,
  ): LedgerEntry {
    if (currency !== this.currency) {
      throw new CurrencyMismatchError(this.currency, currency);
    }

    const debitIdempotencyKey = `${LedgerEntryType.PENDING_REVERSAL}_${escrowId.toString()}`;
    const creditIdempotencyKey = `${LedgerEntryType.REFUND_CREDIT}_${escrowId.toString()}`;
    const entry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.REFUND_CREDIT,
      amountKobo,
      currency,
      escrowId,
      gatewayReference,
      idempotencyKey: creditIdempotencyKey,
    });
    this.addDomainEvent(
      ClientRefunded.fromAggregate(
        this,
        escrowId,
        gatewayReference,
        correlationId,
      ),
    );
    return entry;
  }
}

export { Wallet };
