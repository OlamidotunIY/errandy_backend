import { LedgerEntryType } from '@module/wallet/domain';
import { Query } from '@nestjs/cqrs';
import { UserId } from '@src/users';

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
  amount: Money;
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
