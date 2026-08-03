import { WalletId } from './wallet.id';
import { LedgerEntryType } from '.';
import { EscrowId, Money } from '@module/escrow';
import { Json } from '@src/common';
import { UserId } from '@module/user';

interface CreateLedgerEntryParams {
  walletId: WalletId;
  userId: UserId;
  type: LedgerEntryType;
  amount: Money;
  escrowId: EscrowId | null;
  gatewayReference: string | null;
  metadata?: Json | null;
  idempotencyKey: string;
}

export { CreateLedgerEntryParams };
