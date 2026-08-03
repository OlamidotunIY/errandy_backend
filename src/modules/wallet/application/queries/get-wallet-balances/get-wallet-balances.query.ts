import { Query } from '@nestjs/cqrs';
import { UserId } from '@module/user';

class GetWalletBalancesQuery extends Query<WalletBalancesDTO> {
  constructor(public readonly userId: UserId) {
    super();
  }
}

interface WalletBalancesDTO {
  activeMinorUnits: number;
  pendingMinorUnits: number;
  availableMinorUnits: number;
  currency: string;
}
export { GetWalletBalancesQuery, WalletBalancesDTO };
