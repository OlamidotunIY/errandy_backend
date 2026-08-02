import { DomainError, DomainErrorStatus } from '@src/common';

class InvalidLedgerAmountError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}

export { InvalidLedgerAmountError };
