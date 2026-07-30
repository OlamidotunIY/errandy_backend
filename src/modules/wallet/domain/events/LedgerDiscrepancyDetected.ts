import { DomainEvent, EntityId } from '@shared';
import { Wallet, WalletId } from 'src/modules/wallet/domain';

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
  ) {
    this.eventId = crypto.randomUUID();
    this.eventName = LedgerDiscrepancyDetected.name;
    this.occurredAt = new Date();
  }
}
