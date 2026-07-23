import { UserId } from '@user';
import { Wallet, WalletId } from '../';

interface IWalletRepository {
  findById(id: WalletId): Promise<Wallet | null>;
  findByUserId(userId: UserId): Promise<Wallet | null>;
}

export { IWalletRepository };
