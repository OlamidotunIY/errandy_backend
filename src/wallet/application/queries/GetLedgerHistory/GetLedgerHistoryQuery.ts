import { EscrowId } from '@escrow';
import { UserId } from '@user';
import { LedgerEntryId, LedgerEntryType, WalletId } from '@wallet';
import { Query } from '@nestjs/cqrs';

class GetLedgerHistoryQuery extends Query<LedgerHistoryPageDTO> {
  constructor(
    public readonly walletId: WalletId,
    public readonly cursor: string | null,
    public readonly limit: number,
  ) {
    super();
  }
}

interface LedgerEntryDTO {
  id: LedgerEntryId;
  type: LedgerEntryType;
  amountKobo: number;
  currency: string;
  escrowId: EscrowId | null;
  gatewayReference: string | null;
  createdAt: Date;
}

interface LedgerHistoryPageDTO {
  entries: LedgerEntryDTO[];
  nextCursor: string | null;
}

export { GetLedgerHistoryQuery, LedgerEntryDTO, LedgerHistoryPageDTO };
