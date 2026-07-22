class EscrowReleasedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EntityId;
  readonly eventName: string;

  constructor(
    public readonly escrowId: EscrowId,
    public readonly errandId: string,
    public readonly workerId: string,
    public readonly amount: Money,
    public readonly occurredAt: Date,
  ) {
    this.eventName = 'EscrowReleasedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = escrowId;
    this.eventId = crypto.randomUUID();
  }

  static fromAggregate(escrow: Escrow): EscrowReleasedEvent {
    return new EscrowReleasedEvent(
      escrow.id,
      escrow.errandId,
      escrow.workerId,
      escrow.amountNetWorker,
      escrow.releasedAt!,
    );
  }
}
