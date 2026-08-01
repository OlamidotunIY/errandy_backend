import { EscrowId } from '@module/escrow';
import { DomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';

export class ErrandCompletedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: EscrowId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    public readonly errandId: ErrandId,
    occurredAt: Date,
    correlationId: string,
    public readonly payload: Record<string, unknown>,
  ) {
    this.eventName = 'ErrandCompletedEvent';
    this.occurredAt = occurredAt;
    this.aggregateId = errandId;
    this.correlationId = correlationId;
    this.eventId = crypto.randomUUID();
  }

  // static fromAggregate(errand: Errand): EscrowCompletedEvent {
  //   return new EscrowCompletedEvent(escrow.id, new Date(), {
  //     errandId: escrow.errandId,
  //     clientId: escrow.clientId,
  //     amount: escrow.amountGross,
  //   });
  // }
}
