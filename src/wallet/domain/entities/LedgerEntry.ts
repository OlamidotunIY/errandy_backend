import { EscrowId } from '@escrow';
import {
  CreateLedgerEntryParams,
  LedgerEntryId,
  LedgerEntryType,
  WalletId,
} from '../value-objects';
import { UserId } from '@user';
import { InvalidLedgerAmountError } from '../errors';

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
    public readonly metadata: Record<string, unknown> | null,
    public readonly createdAt: Date,
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
    );
  }
}

export { LedgerEntry };
