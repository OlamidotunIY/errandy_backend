import { DomainEvent } from '@shared';
import { ApplicationId } from '../value-objects';
import { Application } from '../entities';

class ApplicationRejectedEvent implements DomainEvent {
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
    this.eventName = 'ApplicationRejectedEvent';
    this.occurredAt = occurredAt;
    this.eventId = crypto.randomUUID();
    this.aggregateId = aggregateId;
    this.correlationId = correlationId;
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
