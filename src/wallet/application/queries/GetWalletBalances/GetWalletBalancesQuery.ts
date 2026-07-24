import { UserId } from '@user';
import { Query } from '@nestjs/cqrs';

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
