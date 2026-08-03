import { DomainError, DomainErrorStatus } from '@src/common';

class NegativeAmountError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}

export { NegativeAmountError };
