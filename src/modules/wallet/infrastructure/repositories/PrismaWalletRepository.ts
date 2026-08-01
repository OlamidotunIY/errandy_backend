import {
  WalletRepository,
  Wallet,
  WalletId,
  WalletMapper,
} from '@module/wallet';
import { PrismaService } from '@src/prisma/prisma.service';
import { UserId } from '@module/user';

export class PrismaWalletRepository implements WalletRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: WalletMapper,
  ) {}

  async findById(id: WalletId): Promise<Wallet | null> {
    const walletRow = await this.prisma.wallet.findFirst({
      where: { id: id.value },
    });

    return walletRow ? this.mapper.toDomain(walletRow) : null;
  }

  async findByUserId(userId: UserId): Promise<Wallet | null> {
    const walletRow = await this.prisma.wallet.findFirst({
      where: { userId: userId.value },
    });

    return walletRow ? this.mapper.toDomain(walletRow) : null;
  }
}
