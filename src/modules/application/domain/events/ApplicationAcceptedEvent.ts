import { ApplicationId } from '../';
import { Application } from '../entities';
import { DomainEvent } from '@src/common';

class ApplicationAcceptedEvent implements DomainEvent {
  readonly eventId: string;
  readonly aggregateId: ApplicationId;
  readonly eventName: string;
  readonly correlationId: string;
  readonly occurredAt: Date;

  constructor(
    aggregateId: ApplicationId,
    occurredAt: Date,
    correlationId: string,
    public readonly payload: Record<string, unknown>,
  ) {
    this.eventName = 'ApplicationAcceptedEvent';
    this.occurredAt = occurredAt;
    this.eventId = crypto.randomUUID();
    this.aggregateId = aggregateId;
    this.correlationId = correlationId;
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
        errandId: application.errandId,
        workerId: application.workerId,
      },
    );
  }
}

export { ApplicationAcceptedEvent };
