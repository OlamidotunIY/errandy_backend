import { Injectable } from '@nestjs/common';
import { Prisma, Wallet as PrismaWalletRow } from '@prisma/client';
import { Wallet, WalletId } from '@module/wallet';
import { Currency } from '@module/escrow';
import { UserId } from '@src/users';

@Injectable()
class WalletMapper {
  toDomain(prismaWallet: PrismaWalletRow): Wallet {
    return Wallet.reconstitute(
      WalletId.fromString(prismaWallet.id),
      UserId.fromString(prismaWallet.userId),
      prismaWallet.currency as Currency,
      prismaWallet.createdAt,
      prismaWallet.updatedAt,
    );
  }

  toPersistence(wallet: Wallet): Prisma.WalletCreateInput {
    return {
      id: wallet.id.value,
      userId: wallet.userId.value,
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}

export { WalletMapper };
