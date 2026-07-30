import { LedgerEntry } from '../entities';
import { WalletId } from '..';

enum BucketType {
  ACTIVE = 'active',
  PENDING = 'pending',
  AVAILABLE = 'available',
}

interface LedgerEntryPage {
  entries: LedgerEntry[];
  nextCursor: string | null;
}

export abstract class LedgerEntryRepository {
  abstract append(entry: LedgerEntry): Promise<LedgerEntry[]>;
  abstract findByWalletId(walletId: WalletId): Promise<LedgerEntry[]>;
  // abstract findByEscrowId(escrowId: EscrowId): Promise<LedgerEntry[]>;
  abstract findByGatewayReference(
    gatewayReference: string,
  ): Promise<LedgerEntry[]>;
  abstract findPageByWalletId(
    walletId: WalletId,
    cursor: string | null,
    limit: number,
  ): Promise<LedgerEntryPage>;
  abstract appendManyIfBalanceSufficient(
    walletId: WalletId,
    bucket: BucketType,
    requiredAmountKobo: number,
    entries: LedgerEntry[],
  ): Promise<LedgerEntry[]>;
}

export { BucketType, LedgerEntryPage };
