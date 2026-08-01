import { Query } from '@nestjs/cqrs';
import { UserId } from '@module/user';

class GetWalletBalancesQuery extends Query<WalletBalancesDTO> {
  constructor(public readonly userId: UserId) {
    super();
  }
}

interface WalletBalancesDTO {
  activeKobo: number;
  pendingKobo: number;
  availableKobo: number;
  currency: string;
}
export { GetWalletBalancesQuery, WalletBalancesDTO };
