import { Injectable } from '@nestjs/common';
import {
  BucketType,
  DuplicateLedgerEntryError,
  InsufficientBalanceError,
  LedgerBalanceCalculator,
  LedgerEntry,
  LedgerEntryPage,
  LedgerEntryRepository,
  WalletId,
} from '@module/wallet';
import {
  isTransientTransactionError,
  isUniqueConstraintViolation,
  PrismaService,
} from '@src/prisma/prisma.service';
import { LedgerEntryMapper } from '../mappers';

@Injectable()
class PrismaLedgerEntryRepository implements LedgerEntryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: LedgerEntryMapper,
    private readonly ledgerBalanceCalculator: LedgerBalanceCalculator,
  ) {}

  async append(entry: LedgerEntry): Promise<LedgerEntry[]> {
    try {
      const sequence = await this.sequenceGeneratorNext(entry.walletId);
      entry.assignSequence(sequence);

      const appendedEntry = await this.prisma.ledgerEntry.create({
        data: {
          ...this.mapper.toPersistence(entry),
          sequence: entry.sequence ?? 0,
        },
      });

      return [this.mapper.toDomain(appendedEntry)];
    } catch (e) {
      if (isUniqueConstraintViolation(e, 'idempotencyKey')) {
        throw new DuplicateLedgerEntryError(entry.idempotencyKey);
      }
      throw e;
    }
  }

  async findByWalletId(walletId: WalletId): Promise<LedgerEntry[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        walletId: walletId.value,
      },
    });

    return entries.map((entry) => this.mapper.toDomain(entry));
  }

  async findByGatewayReference(
    gatewayReference: string,
  ): Promise<LedgerEntry[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        gatewayReference,
      },
    });

    return entries.map((entry) => this.mapper.toDomain(entry));
  }

  async findPageByWalletId(
    walletId: WalletId,
    cursor: string | null,
    limit: number,
  ): Promise<LedgerEntryPage> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        walletId: walletId.value,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),
    });

    const hasMore = entries.length > limit;
    const page = hasMore ? entries.slice(0, limit) : entries;

    return {
      entries: page.map((entry) => this.mapper.toDomain(entry)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async appendManyIfBalanceSufficient(
    walletId: WalletId,
    bucket: BucketType,
    requiredAmountMinorUnits: number,
    entries: LedgerEntry[],
  ): Promise<LedgerEntry[]> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const rows = await tx.ledgerEntry.findMany({
            where: { walletId: walletId.toString() },
          });
          let liveBalance = 0;

          switch (bucket) {
            case BucketType.ACTIVE:
              liveBalance = this.ledgerBalanceCalculator.calculateActive(
                rows.map((r) => this.mapper.toDomain(r)),
              );
              break;
            case BucketType.PENDING:
              liveBalance = this.ledgerBalanceCalculator.calculatePending(
                rows.map((r) => this.mapper.toDomain(r)),
              );
              break;
            case BucketType.AVAILABLE:
              liveBalance = this.ledgerBalanceCalculator.calculateAvailable(
                rows.map((r) => this.mapper.toDomain(r)),
              );
              break;
          }

          if (liveBalance < requiredAmountMinorUnits) {
            throw new InsufficientBalanceError(
              bucket,
              requiredAmountMinorUnits,
              liveBalance,
            );
          }

          await tx.ledgerEntry.createMany({
            data: entries.map((e) => this.mapper.toPersistence(e)),
          });
        });
        return entries; // success
      } catch (err) {
        if (isTransientTransactionError(err) && attempt < maxRetries) {
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      'appendManyIfBalanceSufficient: retry loop exited without resolving — this should never happen',
    );
  }

  async sequenceGeneratorNext(walletId: WalletId): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.walletLedgerSequence.findUnique({
        where: {
          walletId: walletId.value,
        },
      });

      const next = (current?.sequence ?? 0) + 1;

      await tx.walletLedgerSequence.upsert({
        where: {
          walletId: walletId.value,
        },
        create: {
          id: crypto.randomUUID(),
          walletId: walletId.value,
          sequence: next,
        },
        update: {
          sequence: next,
        },
      });

      return next;
    });
  }
}

export { PrismaLedgerEntryRepository };
