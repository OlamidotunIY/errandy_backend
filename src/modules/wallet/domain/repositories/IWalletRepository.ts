import { UserId } from '@src/users';
import { Wallet, WalletId } from '..';

export abstract class WalletRepository {
  abstract findById(id: WalletId): Promise<Wallet | null>;
  abstract findByUserId(userId: UserId): Promise<Wallet | null>;
}
