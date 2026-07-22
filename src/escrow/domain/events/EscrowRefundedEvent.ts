import { DomainEvent, EntityId } from '@shared';
import { Escrow, EscrowId, Money } from '../';

class EscrowRefundedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly amount: Money,
    public readonly occurredAt: Date,
  ) {
    this.eventName = 'EscrowRefundedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(escrow: Escrow): EscrowRefundedEvent {
    return new EscrowRefundedEvent(
      escrow.id,
      escrow.errandId,
      escrow.clientId,
      escrow.amountGross,
      escrow.refundedAt!,
    );
  }
}
