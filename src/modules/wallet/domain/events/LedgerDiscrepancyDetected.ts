import { DomainEvent } from '@src/common';
import { LedgerEntryId, WalletId } from '../value-objects';

export class LedgerDiscrepancyDetected implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: LedgerEntryId;
  readonly eventName: string;
  readonly occurredAt: Date;

  constructor(
    public readonly gatewayReference: string,
    public readonly discrepancyType:
      'missing' | 'duplicate' | 'amount-mismatch',
    public readonly amountKobo: number,
    public readonly ledgerEntryId: LedgerEntryId,
  ) {
    this.eventId = crypto.randomUUID();
    this.eventName = LedgerDiscrepancyDetected.name;
    this.occurredAt = new Date();
    this.aggregateId = ledgerEntryId;
  }
}
