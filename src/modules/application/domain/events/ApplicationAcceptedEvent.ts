import { ApplicationId, Application } from '../';
import { BaseDomainEvent } from '@src/common';
import { ErrandId } from '@module/errand';
import { ProviderId } from '@module/providers';

interface ApplicationAcceptedPayload {
  applicationId: ApplicationId;
  errandId: ErrandId;
  workerId: ProviderId;
}

class ApplicationAcceptedEvent extends BaseDomainEvent<
  ApplicationId,
  ApplicationAcceptedPayload
> {
  declare readonly correlationId: string;

  constructor(
    aggregateId: ApplicationId,
    occurredAt: Date,
    correlationId: string,
    payload: ApplicationAcceptedPayload,
  ) {
    super({
      aggregateId,
      occurredAt,
      correlationId,
      eventName: ApplicationAcceptedEvent.name,
      payload,
    });
  }

  static fromAggregate(
    application: Application,
    correlationId: string,
  ): ApplicationAcceptedEvent {
    return new ApplicationAcceptedEvent(
      application.id,
      new Date(),
      correlationId,
      {
        applicationId: application.id,
        errandId: application.errandId,
        workerId: application.workerId,
      },
    );
  }
}

export { ApplicationAcceptedEvent };
