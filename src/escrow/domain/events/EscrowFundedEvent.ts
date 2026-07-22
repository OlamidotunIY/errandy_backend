import { Escrow } from '../entities';

class EscrowFundedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: string,
    public readonly clientId: string,
    public readonly workerId: string,
    public readonly amountGross: Money,
    public readonly platformFee: Money,
    public readonly amountNetWorker: Money,
    public readonly occurredAt: Date,
  ) {
    this.eventName = 'EscrowFundedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(escrow: Escrow): EscrowFundedEvent {
    return new EscrowFundedEvent(
      escrow.id,
      escrow.errandId,
      escrow.clientId,
      escrow.workerId,
      escrow.amountGross,
      escrow.platformFee,
      escrow.amountNetWorker,
      new Date(),
    );
  }
}
