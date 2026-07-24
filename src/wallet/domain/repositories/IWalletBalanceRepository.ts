import { WalletBalancesDTO } from '@wallet/application';
import { WalletId } from '../value-objects';

interface IWalletBalanceRepository {
  getActiveErrandBalance(walletId: WalletId): Promise<number>;
  getPendingBalance(walletId: WalletId): Promise<number>;
  getAvailableBalance(walletId: WalletId): Promise<number>;
  getSnapshotForDisplay(walletId: WalletId): Promise<WalletBalancesDTO>;
}

export { IWalletBalanceRepository };
