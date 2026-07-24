import {
  ILedgerEntryRepository,
  IWalletRepository,
  WalletNotFoundError,
} from '@wallet';
import { GetLedgerHistoryQuery, LedgerHistoryPageDTO } from './';

class GetLedgerHistoryQueryHandler {
  constructor(private readonly ledgerEntryRepository: ILedgerEntryRepository) {}
  async execute(query: GetLedgerHistoryQuery): Promise<LedgerHistoryPageDTO> {
    const { entries, nextCursor } =
      await this.ledgerEntryRepository.findPageByWalletId(
        query.walletId,
        query.cursor,
        query.limit,
      );

    return {
      entries,
      nextCursor,
    };
  }
}

export { GetLedgerHistoryQueryHandler };
