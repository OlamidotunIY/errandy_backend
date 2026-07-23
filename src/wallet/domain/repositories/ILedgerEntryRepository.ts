import { EscrowId } from '@escrow';
import { LedgerEntry } from '../entities';
import { LedgerEntryType, WalletId } from '../value-objects';

interface ILedgerEntryRepository {
  append(entry: LedgerEntry): Promise<void>;
  appendMany(entries: LedgerEntry[]): Promise<void>;
  findByWalletId(walletId: WalletId): Promise<LedgerEntry[]>;
  findByEscrowId(escrowId: EscrowId): Promise<LedgerEntry[]>;
  findByGatewayReference(gatewayReference: string): Promise<LedgerEntry[]>;
  existsForEscrow(escrowId: EscrowId, type: LedgerEntryType): Promise<boolean>;
}

export { ILedgerEntryRepository };
