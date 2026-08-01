import { DomainError, DomainErrorStatus } from '@src/common';

export class ErrandNotOpenError extends DomainError {
  constructor(errandId: string) {
    super(`Errand with id - ${errandId} is not open`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
