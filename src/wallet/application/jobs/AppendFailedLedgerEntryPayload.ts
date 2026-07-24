import { LedgerEntryType, WalletId } from '@wallet';
import { UserId } from '@user';
import { Currency, EscrowId } from '@escrow';

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
