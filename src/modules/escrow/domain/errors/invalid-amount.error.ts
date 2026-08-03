import { DomainError, DomainErrorStatus } from '@src/common';

class InvalidAmountError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}

export { InvalidAmountError };
