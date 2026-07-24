import { WalletBalancesDTO } from '@wallet/application';
import { LedgerEntry, WalletBalanceSnapshot, WalletId } from '@wallet';
import { Currency } from '@escrow';

export abstract class WalletBalanceRepository {
  abstract getSnapshotForDisplay(
    walletId: WalletId,
    currency?: Currency,
  ): Promise<WalletBalancesDTO>;
  abstract apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void>;
  abstract rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot>;
}
