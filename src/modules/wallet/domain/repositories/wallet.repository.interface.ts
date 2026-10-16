import { UserId } from '@module/user/domain';
import { Wallet } from '../entities/wallet.entity';
import { WalletId } from '../value-objects';

export abstract class WalletRepository {
  abstract findById(id: WalletId): Promise<Wallet | null>;
  abstract findByUserId(userId: UserId): Promise<Wallet | null>;
}
