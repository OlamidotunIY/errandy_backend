import { BaseDomainEvent } from '@src/common';
import { ErrandAssignmentId } from '../value-objects';

interface AssignmentConfirmedDonePayload extends Record<string, unknown> {
  errandAssignmentId: string;
  errandId: string;
  profileId: string;
}

export class AssignmentConfirmedDoneEvent extends BaseDomainEvent<
  ErrandAssignmentId,
  AssignmentConfirmedDonePayload
> {
  constructor(
    errandAssignmentId: ErrandAssignmentId,
    correlationId: string | undefined,
    payload: AssignmentConfirmedDonePayload,
  ) {
    super({
      aggregateId: errandAssignmentId,
      correlationId,
      eventName: AssignmentConfirmedDoneEvent.name,
      payload,
    });
  }
}
