import { WalletBalancesDTO } from 'src/modules/wallet/application';
import {
  LedgerEntry,
  WalletBalanceSnapshot,
  WalletId,
} from 'src/modules/wallet';
import { Currency } from 'src/modules/escrow';

export abstract class WalletBalanceRepository {
  abstract getSnapshotForDisplay(
    walletId: WalletId,
    currency?: Currency,
  ): Promise<WalletBalancesDTO>;
  abstract apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void>;
  abstract rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot>;
}
