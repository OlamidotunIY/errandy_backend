import { DomainError, DomainErrorStatus } from '@src/common';

export class ErrandNotFoundError extends DomainError {
  constructor(errandId: string) {
    super(`Errand with id - ${errandId} was not found in our system`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
