import { Injectable } from '@nestjs/common';
import {
  BucketType,
  computeBalanceForBucket,
  DuplicateLedgerEntryError,
  ILedgerEntryRepository,
  InsufficientBalanceError,
  LedgerEntry,
  LedgerEntryPage,
  WalletId,
} from '@wallet';
import {
  isTransientTransactionError,
  isUniqueConstraintViolation,
  PrismaService,
} from 'src/prisma.service';
import { LedgerEntryMapper } from '../mappers';

@Injectable()
class PrismaLedgerEntryRepository implements ILedgerEntryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: LedgerEntryMapper,
  ) {}

  async append(entry: LedgerEntry): Promise<void> {
    try {
      await this.prisma.ledgerEntry.create({
        data: this.mapper.toPersistence(entry),
      });
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
    requiredAmountKobo: number,
    entries: LedgerEntry[],
  ): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const rows = await tx.ledgerEntry.findMany({
            where: { walletId: walletId.toString() },
          });
          const liveBalance = computeBalanceForBucket(
            bucket,
            rows.map((r) => this.mapper.toDomain(r)),
          );

          if (liveBalance < requiredAmountKobo) {
            throw new InsufficientBalanceError(
              bucket,
              requiredAmountKobo,
              liveBalance,
            );
          }

          await tx.ledgerEntry.createMany({
            data: entries.map((e) => this.mapper.toPersistence(e)),
          });
        });
        return; // success
      } catch (err) {
        if (isTransientTransactionError(err) && attempt < maxRetries) {
          continue;
        }
        throw err;
      }
    }
  }
}

export { PrismaLedgerEntryRepository };
