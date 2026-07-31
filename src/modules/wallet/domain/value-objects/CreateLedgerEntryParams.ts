import { WalletId } from './WalletId';
import { LedgerEntryType } from './';
import { Currency, EscrowId } from '@module/escrow';
import { Json } from '@src/common';
import { UserId } from '@module/user';

interface CreateLedgerEntryParams {
  walletId: WalletId;
  userId: UserId;
  type: LedgerEntryType;
  amountKobo: number;
  currency: Currency | null;
  escrowId: EscrowId | null;
  gatewayReference: string | null;
  metadata?: Json | null;
  idempotencyKey: string;
}

export { CreateLedgerEntryParams };
