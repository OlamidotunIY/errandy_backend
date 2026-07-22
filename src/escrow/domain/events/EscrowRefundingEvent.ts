import { Escrow } from '../entities';

class EscrowRefundingEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly amount: Money,
    public readonly reason: RefundReason,
    public readonly occurredAt: Date,
  ) {
    this.eventName = 'EscrowRefundingEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(
    escrow: Escrow,
    reason: RefundReason,
  ): EscrowRefundingEvent {
    return new EscrowRefundingEvent(
      escrow.id,
      escrow.errandId,
      escrow.clientId,
      escrow.amountGross,
      reason,
      new Date(),
    );
  }
}
