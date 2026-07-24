import { Currency } from '@escrow';
import { UserId } from '@user';
import { Command } from '@nestjs/cqrs';

class RecordWithdrawalCommand extends Command<void> {
  constructor(
    public readonly userId: UserId,
    public readonly amountKobo: number,
    public readonly currency: Currency,
    public readonly gatewayReference: string,
  ) {
    super();
  }
}
export { RecordWithdrawalCommand };
