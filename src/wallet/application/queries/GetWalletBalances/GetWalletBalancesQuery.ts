import { UserId } from '@user';

interface GetWalletBalancesQuery {
  userId: UserId;
}

interface WalletBalancesDTO {
  activeKobo: number;
  pendingKobo: number;
  availableKobo: number;
  currency: string;
}
export { GetWalletBalancesQuery, WalletBalancesDTO };
