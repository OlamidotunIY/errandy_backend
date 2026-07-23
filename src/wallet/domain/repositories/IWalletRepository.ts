import { UserId } from '@user';
import { Wallet, WalletId } from '../';

interface IWalletRepository {
  findById(id: WalletId): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
}

export { IWalletRepository };
