import { UserId } from '@module/user';
import { Money } from '@module/escrow';

export class ReverseWithdrawalCommand {
  constructor(
    public readonly userId: UserId,
    public readonly amount: Money,
    public readonly gatewayReference: string,
    public readonly reason: string,
    public readonly correlationId: string,
  ) {}
}
