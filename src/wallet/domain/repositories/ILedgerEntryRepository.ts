import { EscrowId } from '@escrow';
import { LedgerEntry } from '../entities';
import { LedgerEntryType, WalletId } from '../value-objects';

enum BucketType {
  ACTIVE = 'active',
  PENDING = 'pending',
  AVAILABLE = 'available',
}

interface LedgerEntryPage {
  entries: LedgerEntry[];
  nextCursor: string | null;
}

interface ILedgerEntryRepository {
  append(entry: LedgerEntry): Promise<void>;
  findByWalletId(walletId: WalletId): Promise<LedgerEntry[]>;
  // findByEscrowId(escrowId: EscrowId): Promise<LedgerEntry[]>;
  findByGatewayReference(gatewayReference: string): Promise<LedgerEntry[]>;
  findPageByWalletId(
    walletId: WalletId,
    cursor: string | null,
    limit: number,
  ): Promise<LedgerEntryPage>;
  appendManyIfBalanceSufficient(
    walletId: WalletId,
    bucket: BucketType,
    requiredAmountKobo: number,
    entries: LedgerEntry[],
  ): Promise<void>;
}

export { ILedgerEntryRepository, BucketType, LedgerEntryPage };
