import { UserId } from '@user';
import { WalletId } from '../value-objects';
import { EscrowId } from '@escrow';

class ActiveErrandReversed {
  /**
   * Creates the event.
   */
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly escrowId: EscrowId,
    public readonly amountKobo: number,
  ) {}
}
