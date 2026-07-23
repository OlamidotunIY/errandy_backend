import { UserId } from '@user';
import { WalletId } from './WalletId';
import { LedgerEntryType } from './LedgerEntryType';
import { Currency, EscrowId } from '@escrow';

interface CreateLedgerEntryParams {
  walletId: WalletId;
  userId: UserId;
  type: LedgerEntryType;
  amountKobo: number;
  currency: Currency | null;
  escrowId: EscrowId | null;
  gatewayReference: string | null;
  metadata?: Record<string, unknown> | null;
}

export { CreateLedgerEntryParams };
