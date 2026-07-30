import {
  WalletBalanceRepository,
  WalletRepository,
  WalletNotFoundError,
} from 'src/modules/wallet';
import { GetWalletBalancesQuery, WalletBalancesDTO } from '.';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetWalletBalancesQuery)
class GetWalletBalancesHandler implements IQueryHandler<GetWalletBalancesQuery> {
  constructor(
    private readonly walletBalanceRepository: WalletBalanceRepository,
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(query: GetWalletBalancesQuery): Promise<WalletBalancesDTO> {
    const wallet = await this.walletRepository.findByUserId(query.userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    let snapshot = await this.walletBalanceRepository.getSnapshotForDisplay(
      wallet.id,
    );

    if (!snapshot) {
      await this.walletBalanceRepository.rebuild(wallet.id);

      snapshot = await this.walletBalanceRepository.getSnapshotForDisplay(
        wallet.id,
      );
    }

    return {
      activeKobo: snapshot.activeKobo,
      pendingKobo: snapshot.pendingKobo,
      availableKobo: snapshot.availableKobo,
      currency: wallet.currency,
    };
  }
}

export { GetWalletBalancesHandler };
