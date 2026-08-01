import { BaseDomainEvent, DomainEventPayload } from '@src/common';
import { ApplicationId } from '../';
import { Application } from '../entities';

class ApplicationRejectedEvent extends BaseDomainEvent<ApplicationId> {
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
      eventName: ApplicationRejectedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    application: Application,
    correlationId: string,
  ): ApplicationRejectedEvent {
    return new ApplicationRejectedEvent(
      application.id,
      new Date(),
      correlationId,
      {
        errandId: application.errandId,
        workerId: application.workerId,
      },
    );
  }
}

export { ApplicationRejectedEvent };
