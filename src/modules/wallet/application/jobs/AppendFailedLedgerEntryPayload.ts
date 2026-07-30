import { Currency, EscrowId } from '@module/escrow';
import { LedgerEntryType, WalletId } from '@module/wallet/domain';
import { UserId } from '@src/users';

export interface AppendFailedLedgerEntryPayload {
  walletId: WalletId;
  userId: UserId;
  ledgerEntryType: LedgerEntryType;
  amountKobo: number;
  currency: Currency;
  escrowId: EscrowId | null;
  gatewayReference: string;
  idempotencyKey: string;
  rawGatewayEventId: string;
  correlationId: string;
}
