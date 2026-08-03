import { BaseDomainEvent } from '@src/common';
import { LedgerEntryId } from '../value-objects';
import { Money } from '@module/escrow';

interface LedgerDiscrepancyDetectedPayload {
  gatewayReference: string;
  discrepancyType: 'missing' | 'duplicate' | 'amount-mismatch';
  amount: Money;
  ledgerEntryId: LedgerEntryId;
}

export class LedgerDiscrepancyDetected extends BaseDomainEvent<
  LedgerEntryId,
  LedgerDiscrepancyDetectedPayload
> {
  constructor(
    gatewayReference: string,
    discrepancyType: 'missing' | 'duplicate' | 'amount-mismatch',
    amount: Money,
    ledgerEntryId: LedgerEntryId,
  ) {
    super({
      aggregateId: ledgerEntryId,
      eventName: LedgerDiscrepancyDetected.name,
      payload: { gatewayReference, discrepancyType, amount, ledgerEntryId },
    });
  }
}
