import { DomainEvent, EntityId } from '@shared';

export class LedgerDiscrepancyDetected implements DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: Date;

  constructor(
    public readonly gatewayReference: string,
    public readonly discrepancyType:
      'missing' | 'deplicate' | 'amount-mismatch',
    public readonly amountKobo: number,
  ) {
    this.eventId = crypto.randomUUID();
    this.eventName = LedgerDiscrepancyDetected.name;
    this.occurredAt = new Date();
  }
  aggregateId: EntityId;
}
