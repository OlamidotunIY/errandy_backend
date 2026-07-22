import { UserId } from '@user';
import { OwnerType, Wallet, WalletId } from '../';

interface IWalletRepository {
  findById(id: WalletId): Promise<Wallet | null>;
  findByOwner(ownerId: UserId, ownerType: OwnerType): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
}

export { IWalletRepository };
