import {
  IWalletBalanceRepository,
  IWalletRepository,
  WalletNotFoundError,
} from '@wallet';
import { GetWalletBalancesQuery, WalletBalancesDTO } from './';

class GetWalletBalancesHandler {
  constructor(
    private readonly walletBalanceRepository: IWalletBalanceRepository,
    private readonly walletRepository: IWalletRepository,
  ) {}

  async execute(query: GetWalletBalancesQuery): Promise<WalletBalancesDTO> {
    const wallet = await this.walletRepository.findByUserId(query.userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const snapshot = await this.walletBalanceRepository.getSnapshotForDisplay(
      wallet.id,
    );

    return {
      activeKobo: snapshot.activeKobo,
      pendingKobo: snapshot.pendingKobo,
      availableKobo: snapshot.availableKobo,
      currency: wallet.currency,
    };
  }
}

export { GetWalletBalancesHandler };
