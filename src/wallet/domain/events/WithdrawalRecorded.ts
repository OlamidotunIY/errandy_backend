import { UserId } from '@user';
import { WalletId } from '../value-objects';

class WithdrawalRecorded {
  constructor(
    public readonly walletId: WalletId,
    public readonly userId: UserId,
    public readonly amountKobo: number,
    public readonly gatewayReference: string,
  ) {}
}
