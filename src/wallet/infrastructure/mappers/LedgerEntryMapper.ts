import { Injectable } from '@nestjs/common';
import {
  LedgerEntry,
  LedgerEntryId,
  LedgerEntryType,
  WalletId,
} from '@wallet/domain';
import { Prisma, LedgerEntry as PrismaLedgerEntryRow } from '@prisma/client';
import { UserId } from '@user';
import { EscrowId } from '@escrow';
import { Json } from '@shared';

@Injectable()
class LedgerEntryMapper {
  toDomain(row: PrismaLedgerEntryRow): LedgerEntry {
    return LedgerEntry.reconstitute({
      id: LedgerEntryId.fromString(row.id),
      userId: UserId.fromString(row.userId),
      walletId: WalletId.fromString(row.walletId),
      amountKobo: row.amountKobo,
      currency: row.currency,
      escrowId: row.escrowId ? EscrowId.fromString(row.escrowId) : null,
      gatewayReference: row.gatewayReference ? row.gatewayReference : null,
      metadata: row.metadata ? (row.metadata as Json) : null,
      type: row.type as LedgerEntryType,
      createdAt: row.createdAt,
      idempotencyKey: row.idempotencyKey,
    });
  }

  toPersistence(entry: LedgerEntry): Prisma.LedgerEntryCreateInput {
    return {
      id: entry.id.toString(),
      userId: entry.userId.toString(),
      walletId: entry.walletId.toString(),
      amountKobo: entry.amountKobo,
      currency: entry.currency,
      escrowId: entry.escrowId?.value ?? null,
      gatewayReference: entry.gatewayReference ?? null,
      metadata: entry.metadata,
      type: entry.type,
      createdAt: entry.createdAt,
      idempotencyKey: entry.idempotencyKey,
    };
  }
}

export { LedgerEntryMapper };
