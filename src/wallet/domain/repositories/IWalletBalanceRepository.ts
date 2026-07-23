import { WalletId } from '../value-objects';

interface IWalletBalanceRepository {
  getActiveErrandBalance(walletId: WalletId): Promise<number>;
  getPendingBalance(walletId: WalletId): Promise<number>;
  getAvailableBalance(walletId: WalletId): Promise<number>;
}

export { IWalletBalanceRepository };
