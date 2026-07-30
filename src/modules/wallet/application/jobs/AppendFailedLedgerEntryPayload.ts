import { LedgerEntryType, WalletId } from 'src/modules/wallet';
import { UserId } from '@user';
import { Currency, EscrowId } from 'src/modules/escrow';

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
