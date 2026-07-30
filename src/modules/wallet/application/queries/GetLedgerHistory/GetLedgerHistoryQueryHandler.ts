import {
  LedgerEntryRepository,
  WalletRepository,
  WalletNotFoundError,
} from 'src/modules/wallet';
import { GetLedgerHistoryQuery, LedgerHistoryPageDTO } from '.';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetLedgerHistoryQuery)
class GetLedgerHistoryQueryHandler implements IQueryHandler<GetLedgerHistoryQuery> {
  constructor(
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(query: GetLedgerHistoryQuery): Promise<LedgerHistoryPageDTO> {
    const wallet = await this.walletRepository.findByUserId(query.userId);

    if (!wallet) {
      throw new WalletNotFoundError();
    }

    const { entries, nextCursor } =
      await this.ledgerEntryRepository.findPageByWalletId(
        wallet.id,
        query.cursor,
        query.limit,
      );

    return {
      entries: entries.map((entry) => ({
        id: entry.id.value,
        type: entry.type,
        amountKobo: entry.amountKobo,
        currency: entry.currency,
        escrowId: entry.escrowId ? entry.escrowId.value : null,
        gatewayReference: entry.gatewayReference,
        createdAt: entry.createdAt,
      })),
      nextCursor,
    };
  }
}

export { GetLedgerHistoryQueryHandler };
