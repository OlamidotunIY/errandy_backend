import { DomainError, DomainErrorStatus } from '@src/common';

export class ApplicationNotFoundError extends DomainError {
  constructor(applicationId: string) {
    super(`Application with id - ${applicationId} was not found in our system`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
