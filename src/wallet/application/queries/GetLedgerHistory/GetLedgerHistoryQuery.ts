import { EscrowId } from '@escrow';
import { UserId } from '@user';
import { LedgerEntryId, LedgerEntryType, WalletId } from '@wallet';

interface GetLedgerHistoryQuery {
  walletId: WalletId;
  cursor: string | null;
  limit: number;
}

interface LedgerEntryDTO {
  id: LedgerEntryId;
  type: LedgerEntryType;
  amountKobo: number;
  currency: string;
  escrowId: EscrowId | null;
  createdAt: Date;
}

interface LedgerHistoryPageDTO {
  entries: LedgerEntryDTO[];
  nextCursor: string | null;
}

export { GetLedgerHistoryQuery, LedgerEntryDTO, LedgerHistoryPageDTO };
