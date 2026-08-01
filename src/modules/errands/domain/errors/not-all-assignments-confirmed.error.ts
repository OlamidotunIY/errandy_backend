import { DomainError, DomainErrorStatus } from '@src/common';

export class NotAllAssignmentsConfirmedError extends DomainError {
  constructor(errandId: string) {
    super(
      `Errand with id - ${errandId} cannot be completed: not all assignments are confirmed done`,
      { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY },
    );
  }
}
