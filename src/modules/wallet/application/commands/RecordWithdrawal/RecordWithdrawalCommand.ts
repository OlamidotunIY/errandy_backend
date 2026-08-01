import { Currency, Money } from '@module/escrow';
import { Command } from '@nestjs/cqrs';
import { UserId } from '@module/user';

class RecordWithdrawalCommand extends Command<void> {
  constructor(
    public readonly userId: UserId,
    public readonly amount: Money,
    public readonly currency: Currency,
    public readonly gatewayReference: string,
    public readonly correlationId: string,
  ) {
    super();
  }
}
export { RecordWithdrawalCommand };
