import { Currency, EscrowId } from '@escrow';
import { UserId } from '@user';

interface ReverseActiveErrandCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: Currency;
  gatewayReference: string;
}

export { ReverseActiveErrandCommand };
