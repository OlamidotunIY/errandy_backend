import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { ApplicationId } from '../value-objects';
import { Application } from '../entities';

class ApplicationSubmittedEvent extends BaseDomainEvent<ApplicationId> {
  constructor(
    aggregateId: ApplicationId,
    occurredAt: Date,
    correlationId: string,
    payload: DomainEventPayload,
  ) {
    super({
      aggregateId,
      occurredAt,
      correlationId,
      eventName: ApplicationSubmittedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    application: Application,
    correlationId: string,
  ): ApplicationSubmittedEvent {
    return new ApplicationSubmittedEvent(
      application.id,
      new Date(),
      correlationId,
      {
        errandId: application.errandId,
        workerId: application.workerId,
        proposal: application.proposal(),
        proposedAmountMinorUnits: application.proposedAmountMinorUnits(),
        currency: application.currency(),
      },
    );
  }
}

export { ApplicationSubmittedEvent };
