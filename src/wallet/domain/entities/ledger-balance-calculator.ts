// wallet/domain/ledger-balance-calculator.ts

import { LedgerEntryType } from '../value-objects';
import { LedgerEntry } from './LedgerEntry';
import { BucketType } from '@wallet/domain';

/**
 * Sums the active-errand bucket: credited by ACTIVE_ERRAND_CREDIT, debited by
 * ACTIVE_ERRAND_REVERSAL (both the cancellation-before-completion case and the
 * "moved out to pending" case use this same reversal type).
 */
export function computeActiveErrandBalanceKobo(entries: LedgerEntry[]): number {
  return entries.reduce((sum, entry) => {
    if (entry.type === LedgerEntryType.ACTIVE_ERRAND_CREDIT)
      return sum + entry.amountKobo;
    if (entry.type === LedgerEntryType.ACTIVE_ERRAND_REVERSAL)
      return sum - entry.amountKobo;
    return sum;
  }, 0);
}

/** Sums the pending bucket: credited by PENDING_CREDIT, debited when it clears to available. */
export function computePendingBalanceKobo(entries: LedgerEntry[]): number {
  return entries.reduce((sum, entry) => {
    if (entry.type === LedgerEntryType.PENDING_CREDIT)
      return sum + entry.amountKobo;
    if (entry.type === LedgerEntryType.PENDING_REVERSAL)
      return sum - entry.amountKobo;
    return sum;
  }, 0);
}

/** Sums the available (withdrawable) bucket: credited by AVAILABLE_CREDIT, debited by WITHDRAWAL_DEBIT. */
export function computeAvailableBalanceKobo(entries: LedgerEntry[]): number {
  return entries.reduce((sum, entry) => {
    if (entry.type === LedgerEntryType.AVAILABLE_CREDIT)
      return sum + entry.amountKobo;
    if (entry.type === LedgerEntryType.WITHDRAWAL_DEBIT)
      return sum - entry.amountKobo;
    return sum;
  }, 0);
}

export function computeBalanceForBucket(
  bucket: BucketType,
  entries: LedgerEntry[],
): number {
  switch (bucket) {
    case BucketType.ACTIVE:
      return computeActiveErrandBalanceKobo(entries);
    case BucketType.PENDING:
      return computePendingBalanceKobo(entries);
    case BucketType.AVAILABLE:
      return computeAvailableBalanceKobo(entries);
    default:
      throw new Error(`Unknown bucket type: ${bucket as string}`);
  }
}
