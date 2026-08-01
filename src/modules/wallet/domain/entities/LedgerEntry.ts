import { EscrowId } from '@module/escrow';
import {
  CreateLedgerEntryParams,
  LedgerEntryId,
  LedgerEntryType,
  WalletId,
} from '@module/wallet';
import { InvalidLedgerAmountError } from '../errors';
import { Money } from 'src/modules/escrow';
import { UserId } from '@src/users';
import { Json } from '@src/common';

class LedgerEntry {
  private constructor(
    public readonly id: LedgerEntryId,
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly type: LedgerEntryType,
    public readonly amount: Money,
    public readonly escrowId: EscrowId | null,
    public readonly gatewayReference: string | null,
    public readonly metadata: Json | null,
    public readonly createdAt: Date,
    public readonly idempotencyKey: string,
    public sequence: number | null = null,
  ) {}

  static create(params: CreateLedgerEntryParams): LedgerEntry {
    if (!params.type) {
      throw new Error('LedgerEntryType is required to create a ledger entry');
    }
    if (params.amount.isZero()) {
      throw new InvalidLedgerAmountError(
        'Amount must be greater than zero to create a ledger entry',
      );
    }
    return new LedgerEntry(
      new LedgerEntryId(crypto.randomUUID()),
      params.walletId,
      params.userId,
      params.type,
      params.amount,
      params.escrowId ?? null,
      params.gatewayReference ?? null,
      params.metadata ?? null,
      new Date(),
      params.idempotencyKey,
      null,
    );
  }

  static reconstitute(params: {
    id: LedgerEntryId;
    walletId: WalletId;
    userId: UserId;
    type: LedgerEntryType;
    amount: Money;
    escrowId: EscrowId | null;
    gatewayReference: string | null;
    metadata: Json | null;
    createdAt: Date;
    idempotencyKey: string;
    sequence: number;
  }): LedgerEntry {
    return new LedgerEntry(
      params.id,
      params.walletId,
      params.userId,
      params.type,
      params.amount,
      params.escrowId,
      params.gatewayReference,
      params.metadata,
      params.createdAt,
      params.idempotencyKey,
      params.sequence,
    );
  }

  assignSequence(sequence: number): LedgerEntry {
    this.sequence = sequence;
    return this;
  }
}

export { LedgerEntry };
