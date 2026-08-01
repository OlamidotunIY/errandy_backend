import {
  LedgerEntry,
  LedgerEntryType,
  WalletBalancesDTO,
} from '@module/wallet';
import { Currency } from '@module/escrow';

class LedgerBalanceCalculator {
  calculate(entries: LedgerEntry[], currency: Currency): WalletBalancesDTO {
    return {
      activeKobo: this.calculateActive(entries),
      pendingKobo: this.calculatePending(entries),
      availableKobo: this.calculateAvailable(entries),
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
