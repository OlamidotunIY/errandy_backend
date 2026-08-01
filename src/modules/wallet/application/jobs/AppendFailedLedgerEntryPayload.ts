import { Currency, EscrowId, Money } from '@module/escrow';
import { LedgerEntryType, WalletId } from '@module/wallet/domain';
import { UserId } from '@module/user';

export interface AppendFailedLedgerEntryPayload {
  walletId: WalletId;
  userId: UserId;
  ledgerEntryType: LedgerEntryType;
  amount: Money;
  currency: Currency;
  escrowId: EscrowId | null;
  gatewayReference: string;
  idempotencyKey: string;
  rawGatewayEventId: string;
  correlationId: string;
}
