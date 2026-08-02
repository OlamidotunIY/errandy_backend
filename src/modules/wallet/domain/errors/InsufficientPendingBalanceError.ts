import { DomainError, DomainErrorStatus } from '@src/common';

class InsufficientPendingBalanceError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}

export { InsufficientPendingBalanceError };
