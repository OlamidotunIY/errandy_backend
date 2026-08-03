import { Injectable } from '@nestjs/common';
import {
  Prisma,
  WalletBalanceSnapshot as PrismaWalletBalanceSnapshot,
} from '@prisma/client';
import {
  WalletBalanceSnapshot,
  WalletBalanceSnapshotId,
  WalletId,
} from '@module/wallet';

@Injectable()
export class WalletBalanceSnapshotMapper {
  toDomain(
    prismaBalanceSnapshot: PrismaWalletBalanceSnapshot,
  ): WalletBalanceSnapshot {
    return WalletBalanceSnapshot.reconstitute(
      new WalletBalanceSnapshotId(prismaBalanceSnapshot.id),
      new WalletId(prismaBalanceSnapshot.walletId),
      prismaBalanceSnapshot.activeErrandBalance,
      prismaBalanceSnapshot.pendingBalance,
      prismaBalanceSnapshot.availableBalance,
      prismaBalanceSnapshot.lastSequence,
      prismaBalanceSnapshot.updatedAt,
    );
  }

  toPersistence(
    balanceSnapshot: WalletBalanceSnapshot,
  ): Prisma.WalletBalanceSnapshotCreateInput {
    return {
      activeErrandBalance: balanceSnapshot.activeMinorUnits,
      availableBalance: balanceSnapshot.availableMinorUnits,
      id: balanceSnapshot.id.value,
      lastSequence: balanceSnapshot.lastSequence,
      pendingBalance: balanceSnapshot.pendingMinorUnits,
      walletId: balanceSnapshot.walletId.value,
      updatedAt: balanceSnapshot.updatedAt,
    };
  }
}
