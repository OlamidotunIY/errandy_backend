import { DomainError, DomainErrorStatus } from '@src/common';

class InsufficientActiveBalanceError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}

export { InsufficientActiveBalanceError };
