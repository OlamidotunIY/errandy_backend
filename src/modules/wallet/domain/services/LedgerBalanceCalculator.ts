import { LedgerEntry, LedgerEntryType } from 'src/modules/wallet/domain';
import { WalletBalancesDTO } from 'src/modules/wallet/application';
import { Currency } from 'src/modules/escrow';

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
        return sum + entry.amountKobo;
      if (entry.type === LedgerEntryType.PENDING_REVERSAL)
        return sum - entry.amountKobo;
      return sum;
    }, 0);
  }

  calculateActive(entries: LedgerEntry[]): number {
    return entries.reduce((sum, entry) => {
      if (entry.type === LedgerEntryType.ACTIVE_ERRAND_CREDIT)
        return sum + entry.amountKobo;
      if (entry.type === LedgerEntryType.ACTIVE_ERRAND_REVERSAL)
        return sum - entry.amountKobo;
      return sum;
    }, 0);
  }

  calculateAvailable(entries: LedgerEntry[]): number {
    return entries.reduce((sum, entry) => {
      if (entry.type === LedgerEntryType.AVAILABLE_CREDIT)
        return sum + entry.amountKobo;
      if (entry.type === LedgerEntryType.WITHDRAWAL_DEBIT)
        return sum - entry.amountKobo;
      return sum;
    }, 0);
  }
}

export { LedgerBalanceCalculator };
