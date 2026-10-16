import { WalletBalancesDTO } from '../../application/queries/get-wallet-balances/get-wallet-balances.query';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { WalletBalanceSnapshot } from '../entities/wallet-balance-snapshot.entity';
import { WalletId } from '../value-objects';
import { Currency } from '@module/escrow/domain';

export abstract class WalletBalanceRepository {
  abstract getSnapshotForDisplay(
    walletId: WalletId,
    currency?: Currency,
  ): Promise<WalletBalancesDTO>;
  abstract apply(walletId: WalletId, entries: LedgerEntry[]): Promise<void>;
  abstract rebuild(walletId: WalletId): Promise<WalletBalanceSnapshot>;
}
