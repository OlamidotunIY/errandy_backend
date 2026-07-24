import { Currency, EscrowId } from '@escrow';
import { UserId } from '@user';

interface ReleaseToAvailableCommand {
  workerUserId: UserId;
  escrowId: EscrowId;
  amountKobo: number;
  currency: Currency;
}

export { ReleaseToAvailableCommand };
