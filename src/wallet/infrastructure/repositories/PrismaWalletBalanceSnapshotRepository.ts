import { Injectable } from '@nestjs/common';
import {
  WalletBalanceRepository,
  LedgerEntry,
  WalletBalanceSnapshot,
  WalletId,
} from '@wallet/domain';
import { PrismaService } from '../../../prisma.service';
import { Currency } from '@escrow';
import { WalletBalanceSnapshotMapper } from '../';
import { WalletBalancesDTO } from '@wallet/application';

@Injectable()
export class PrismaWalletBalanceSnapshotRepository implements WalletBalanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: WalletBalanceSnapshotMapper,
  ) {}

  async getSnapshotForDisplay(
    walletId: WalletId,
    currency: Currency,
  ): Promise<WalletBalancesDTO> {
    const snapshot = await this.prisma.walletBalanceSnapshot.findUnique({
      where: {
        walletId: walletId.value,
      },
    });

    return {
      activeKobo: snapshot?.activeErrandBalance ?? 0,
      pendingKobo: snapshot?.pendingBalance ?? 0,
      availableKobo: snapshot?.availableBalance ?? 0,
      currency: currency ?? 'NGN',
    };
  }
  async apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void> {
    if (entries.length === 0) {
      return Promise.resolve();
    }

    const existing = await this.prisma.walletBalanceSnapshot.findUnique({
      where: {
        walletId: walletId.value,
      },
    });

    const snapshot = existing
      ? this.mapper.toDomain(existing)
      : WalletBalanceSnapshot.create(walletId);

    const unappliedEntries = entries
      .filter(
        (entry): entry is LedgerEntry & { sequence: number } =>
          entry.sequence !== null,
      )
      .filter((entry) => entry.sequence > snapshot.lastSequence)
      .sort((a, b) => a.sequence - b.sequence);

    if (unappliedEntries.length === 0) {
      return Promise.resolve();
    }

    const updatedSnapshot = snapshot.apply(
      unappliedEntries,
      walletId,
      snapshot.id,
    );

    await this.prisma.walletBalanceSnapshot.upsert({
      where: {
        walletId: walletId.value,
      },
      create: this.mapper.toPersistence(updatedSnapshot),
      update: {
        lastSequence: updatedSnapshot.lastSequence,
        availableBalance: updatedSnapshot.availableKobo,
        pendingBalance: updatedSnapshot.pendingKobo,
        activeErrandBalance: updatedSnapshot.activeKobo,
      },
    });
  }
  rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot> {
    throw new Error('Method not implemented.');
  }
}
