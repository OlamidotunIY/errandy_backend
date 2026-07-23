import { Currency, EscrowId } from '@escrow';
import { UserId } from '@user';

interface MoveActiveToPendingCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: Currency;
}

export { MoveActiveToPendingCommand };
