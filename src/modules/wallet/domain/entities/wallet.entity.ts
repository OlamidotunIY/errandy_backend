import { LedgerEntryType, WalletId } from '..';
import { Currency, EscrowId, Money } from '@module/escrow';
import { LedgerEntry } from './ledger-entry.entity';
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
import { AggregateRoot } from '@src/common';
import { UserId } from '@module/user';

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

  static create(userId: UserId, currency: Currency = 'NGN'): Wallet {
    if (!userId) {
      throw new Error('UserId is required to create a wallet');
    }
    const now = new Date();
    return new Wallet(new WalletId(crypto.randomUUID()), userId, currency, now, now);
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
    amount: Money,
    escrowId: EscrowId,
    gatewayReference: string,
    correlationId: string,
  ): LedgerEntry {
    const idempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_CREDIT}_${escrowId.toString()}`;
    const entries = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.ACTIVE_ERRAND_CREDIT,
      amount,
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
    amount: Money,
    escrowId: EscrowId,
    computedActiveBalance: Money,
    correlationId: string,
  ): LedgerEntry[] {
    if (computedActiveBalance.lessThan(amount)) {
      throw new InsufficientActiveBalanceError(
        `Insufficient active balance to move ${amount.toString()} to pending`,
      );
    }
    const debitIdempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_REVERSAL}_${escrowId.toString()}`;
    const creditIdempotencyKey = `${LedgerEntryType.PENDING_CREDIT}_${escrowId.toString()}`;
    const debitEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.ACTIVE_ERRAND_REVERSAL,
      amount,
      escrowId,
      gatewayReference: null,
      idempotencyKey: debitIdempotencyKey,
    });
    const creditEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.PENDING_CREDIT,
      amount,
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
    amount: Money,
    escrowId: EscrowId,
    computedPendingBalance: Money,
    correlationId: string,
  ): LedgerEntry[] {
    if (computedPendingBalance.lessThan(amount)) {
      throw new InsufficientPendingBalanceError(
        `Insufficient pending balance to move ${amount.toString()} to available`,
      );
    }

    const debitIdempotencyKey = `${LedgerEntryType.PENDING_REVERSAL}_${escrowId.toString()}`;
    const creditIdempotencyKey = `${LedgerEntryType.AVAILABLE_CREDIT}_${escrowId.toString()}`;

    const creditEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.AVAILABLE_CREDIT,
      amount,
      escrowId,
      gatewayReference: null,
      idempotencyKey: creditIdempotencyKey,
    });

    const debitEntry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.PENDING_REVERSAL,
      amount,
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
    amount: Money,
    gatewayReference: string,
    computedAvailableBalance: Money,
    correlationId: string,
  ): LedgerEntry {
    if (computedAvailableBalance.lessThan(amount)) {
      throw new InsufficientAvailableBalanceError(
        `Insufficient available balance to record withdrawal of ${amount.toString()}`,
      );
    }

    const idempotencyKey = `${LedgerEntryType.WITHDRAWAL_DEBIT}_${gatewayReference}`;

    const entry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.WITHDRAWAL_DEBIT,
      amount,
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
    amount: Money,
    escrowId: EscrowId,
    gatewayReference: string,
    computedActiveBalance: Money,
    correlationId: string,
  ): LedgerEntry {
    if (computedActiveBalance.lessThan(amount)) {
      throw new InsufficientActiveBalanceError(
        `Insufficient active balance to record reversal of ${amount.toString()}`,
      );
    }

    const debitIdempotencyKey = `${LedgerEntryType.ACTIVE_ERRAND_REVERSAL}_${escrowId.toString()}`;
    const entry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.ACTIVE_ERRAND_REVERSAL,
      amount,
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
    amount: Money,
    escrowId: EscrowId,
    gatewayReference: string,
    correlationId: string,
  ): LedgerEntry {
    const debitIdempotencyKey = `${LedgerEntryType.PENDING_REVERSAL}_${escrowId.toString()}`;
    const creditIdempotencyKey = `${LedgerEntryType.REFUND_CREDIT}_${escrowId.toString()}`;
    const entry = LedgerEntry.create({
      walletId: this.id,
      userId: this.userId,
      type: LedgerEntryType.REFUND_CREDIT,
      amount,
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
