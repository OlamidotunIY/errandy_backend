import { Injectable } from '@nestjs/common';
import {
  LedgerEntry,
  LedgerEntryId,
  LedgerEntryType,
  WalletId,
} from '@module/wallet/domain';
import { Prisma, LedgerEntry as PrismaLedgerEntryRow } from '@prisma/client';
import { Currency, EscrowId, Money } from '@module/escrow';
import { Json } from '@src/common';
import { UserId } from '@module/user';

@Injectable()
class LedgerEntryMapper {
  toDomain(row: PrismaLedgerEntryRow): LedgerEntry {
    return LedgerEntry.reconstitute({
      id: LedgerEntryId.fromString(row.id),
      userId: UserId.fromString(row.userId),
      walletId: WalletId.fromString(row.walletId),
      amount: Money.fromMinorUnits(
        row.amountMinorUnits,
        row.currency as Currency,
      ),
      escrowId: row.escrowId ? EscrowId.fromString(row.escrowId) : null,
      gatewayReference: row.gatewayReference ? row.gatewayReference : null,
      metadata: row.metadata ? (row.metadata as Json) : null,
      type: row.type as LedgerEntryType,
      createdAt: row.createdAt,
      idempotencyKey: row.idempotencyKey,
      sequence: row.sequence,
    });
  }

  toPersistence(entry: LedgerEntry): Prisma.LedgerEntryCreateInput {
    return {
      id: entry.id.toString(),
      userId: entry.userId.toString(),
      walletId: entry.walletId.toString(),
      amountMinorUnits: entry.amount.toMinorUnits(),
      currency: entry.currency,
      escrowId: entry.escrowId?.value ?? null,
      gatewayReference: entry.gatewayReference ?? null,
      metadata: entry.metadata,
      type: entry.type,
      createdAt: entry.createdAt,
      idempotencyKey: entry.idempotencyKey,
      sequence: entry.sequence ?? 0,
    };
  }
}

export { LedgerEntryMapper };
