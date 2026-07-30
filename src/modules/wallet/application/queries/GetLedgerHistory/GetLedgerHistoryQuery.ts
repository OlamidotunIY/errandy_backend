import { EscrowId } from 'src/modules/escrow';
import { UserId } from '@user';
import { LedgerEntryId, LedgerEntryType, WalletId } from 'src/modules/wallet';
import { Query } from '@nestjs/cqrs';

class GetLedgerHistoryQuery extends Query<LedgerHistoryPageDTO> {
  constructor(
    public readonly userId: UserId,
    public readonly cursor: string | null,
    public readonly limit: number,
  ) {
    super();
  }
}

interface LedgerEntryDTO {
  id: string;
  type: LedgerEntryType;
  amountKobo: number;
  currency: string;
  escrowId: string | null;
  gatewayReference: string | null;
  createdAt: Date;
}

interface LedgerHistoryPageDTO {
  entries: LedgerEntryDTO[];
  nextCursor: string | null;
}

export { GetLedgerHistoryQuery, LedgerEntryDTO, LedgerHistoryPageDTO };
