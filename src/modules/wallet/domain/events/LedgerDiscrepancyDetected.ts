import { DomainEvent } from '@src/common';
import { WalletId } from '../value-objects';

export class LedgerDiscrepancyDetected implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: WalletId;
  readonly eventName: string;
  readonly occurredAt: Date;

  constructor(
    public readonly gatewayReference: string,
    public readonly discrepancyType:
      'missing' | 'duplicate' | 'amount-mismatch',
    public readonly amountKobo: number,
    walletId: WalletId,
  ) {
    this.eventId = crypto.randomUUID();
    this.eventName = LedgerDiscrepancyDetected.name;
    this.occurredAt = new Date();
    this.aggregateId = walletId;
  }
}
