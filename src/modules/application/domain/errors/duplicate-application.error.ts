import { DomainError, DomainErrorStatus } from '@src/common';

export class DuplicateApplicationError extends DomainError {
  constructor(errandId: string, workerId: string) {
    super(
      `Application for worker with id - ${workerId} already exist on errand with id - ${errandId}`,
      { statusCode: DomainErrorStatus.CONFLICT },
    );
  }
}
