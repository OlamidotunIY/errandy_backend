import { BaseDomainEvent } from '@src/common';
import { ErrandAssignmentId } from '../value-objects';

interface AssignmentConfirmationUpdatedPayload extends Record<string, unknown> {
  errandAssignmentId: string;
  proofUrl: string;
}

export class AssignmentConfirmationUpdatedEvent extends BaseDomainEvent<
  ErrandAssignmentId,
  AssignmentConfirmationUpdatedPayload
> {
  constructor(
    errandAssignmentId: ErrandAssignmentId,
    correlationId: string | undefined,
    payload: AssignmentConfirmationUpdatedPayload,
  ) {
    super({
      aggregateId: errandAssignmentId,
      correlationId,
      eventName: AssignmentConfirmationUpdatedEvent.name,
      payload,
    });
  }
}
