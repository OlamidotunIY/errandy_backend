import { EscrowId } from '@escrow';
import {
  CreateLedgerEntryParams,
  LedgerEntryId,
  LedgerEntryType,
  WalletId,
} from '../value-objects';
import { UserId } from '@user';
import { InvalidLedgerAmountError } from '../errors';
import { Json } from '@shared';

class LedgerEntry {
  private constructor(
    public readonly id: LedgerEntryId,
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly type: LedgerEntryType,
    public readonly amountKobo: number,
    public readonly currency: string,
    public readonly escrowId: EscrowId | null,
    public readonly gatewayReference: string | null,
    public readonly metadata: Json | null,
    public readonly createdAt: Date,
    public readonly idempotencyKey: string,
  ) {}

  static create(params: CreateLedgerEntryParams): LedgerEntry {
    if (!params.type) {
      throw new Error('LedgerEntryType is required to create a ledger entry');
    }
    if (!params.amountKobo || params.amountKobo <= 0) {
      throw new InvalidLedgerAmountError(
        'Amount must be greater than zero to create a ledger entry',
      );
    }
    if (!params.currency) {
      throw new Error('Currency is required to create a ledger entry');
    }
    return new LedgerEntry(
      new LedgerEntryId(crypto.randomUUID()),
      params.walletId,
      params.userId,
      params.type,
      params.amountKobo,
      params.currency,
      params.escrowId ?? null,
      params.gatewayReference ?? null,
      params.metadata ?? null,
      new Date(),
      params.idempotencyKey,
    );
  }

  static reconstitute(params: {
    id: LedgerEntryId;
    walletId: WalletId;
    userId: UserId;
    type: LedgerEntryType;
    amountKobo: number;
    currency: string;
    escrowId: EscrowId | null;
    gatewayReference: string | null;
    metadata: Json | null;
    createdAt: Date;
    idempotencyKey: string;
  }): LedgerEntry {
    return new LedgerEntry(
      params.id,
      params.walletId,
      params.userId,
      params.type,
      params.amountKobo,
      params.currency,
      params.escrowId,
      params.gatewayReference,
      params.metadata,
      params.createdAt,
      params.idempotencyKey,
    );
  }
}

export { LedgerEntry };
