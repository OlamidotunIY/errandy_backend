import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '../value-objects';

interface ErrandCompletedPayload extends Record<string, unknown> {
  escrowId: string;
  completedAt: Date;
}

export class ErrandCompletedEvent extends BaseDomainEvent<
  ErrandId,
  ErrandCompletedPayload
> {
  declare readonly correlationId: string;

  constructor(
    errandId: ErrandId,
    occurredAt: Date,
    correlationId: string,
    payload: ErrandCompletedPayload,
  ) {
    super({
      aggregateId: errandId,
      occurredAt,
      correlationId,
      eventName: ErrandCompletedEvent.name,
      payload,
    });
  }

  // static fromAggregate(errand: Errand): EscrowCompletedEvent {
  //   return new EscrowCompletedEvent(escrow.id, new Date(), {
  //     errandId: escrow.errandId,
  //     clientId: escrow.clientId,
  //     amount: escrow.amountGross,
  //   });
  // }
}
