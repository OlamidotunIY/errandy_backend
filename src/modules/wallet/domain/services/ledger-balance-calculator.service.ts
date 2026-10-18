import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerEntryType } from '../value-objects';
import { WalletBalancesDTO } from '../../application/queries/get-wallet-balances/get-wallet-balances.query';
import { Currency } from '@module/escrow/domain';

class LedgerBalanceCalculator {
  calculate(entries: LedgerEntry[], currency: Currency): WalletBalancesDTO {
    return {
      activeMinorUnits: this.calculateActive(entries),
      pendingMinorUnits: this.calculatePending(entries),
      availableMinorUnits: this.calculateAvailable(entries),
      currency,
    };
  }

  calculatePending(entries: LedgerEntry[]): number {
    return entries.reduce((sum, entry) => {
      if (entry.type === LedgerEntryType.PENDING_CREDIT)
        return sum + entry.toMinorUnits();
      if (entry.type === LedgerEntryType.PENDING_REVERSAL)
        return sum - entry.toMinorUnits();
      return sum;
    }, 0);
  }

  calculateActive(entries: LedgerEntry[]): number {
    return entries.reduce((sum, entry) => {
      if (entry.type === LedgerEntryType.ACTIVE_ERRAND_CREDIT)
        return sum + entry.toMinorUnits();
      if (entry.type === LedgerEntryType.ACTIVE_ERRAND_REVERSAL)
        return sum - entry.toMinorUnits();
      return sum;
    }, 0);
  }

  calculateAvailable(entries: LedgerEntry[]): number {
    return entries.reduce((sum, entry) => {
      if (entry.type === LedgerEntryType.AVAILABLE_CREDIT)
        return sum + entry.toMinorUnits();
      if (entry.type === LedgerEntryType.WITHDRAWAL_DEBIT)
        return sum - entry.toMinorUnits();
      return sum;
    }, 0);
  }
}

export { LedgerBalanceCalculator };
