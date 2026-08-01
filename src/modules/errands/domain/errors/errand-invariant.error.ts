import { DomainError, DomainErrorStatus } from '@src/common';

export class ErrandInvariantError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}
