import { DomainError, DomainErrorStatus } from '@src/common';

class InsufficientAvailableBalanceError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}

export { InsufficientAvailableBalanceError };
