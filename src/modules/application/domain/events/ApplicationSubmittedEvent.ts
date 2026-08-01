import { DomainEvent } from '@src/common';
import { ApplicationId } from '../value-objects';
import { Application } from '../entities';

class ApplicationSubmittedEvent implements DomainEvent {
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
    this.eventName = 'ApplicationSubmittedEvent';
    this.occurredAt = occurredAt;
    this.eventId = crypto.randomUUID();
    this.aggregateId = aggregateId;
    this.correlationId = correlationId;
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
        proposedAmountKobo: application.proposedAmountKobo(),
        currency: application.currency(),
      },
    );
  }
}

export { ApplicationSubmittedEvent };
