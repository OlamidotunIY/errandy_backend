import { Currency, EscrowId } from '@escrow';
import { UserId } from '@user';
import { WalletId } from '@wallet';

interface CreditActiveErrandCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  walletId: WalletId;
  amountKobo: number;
  currency: Currency;
  gatewayReference: string;
}

export { CreditActiveErrandCommand };
