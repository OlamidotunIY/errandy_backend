import { DomainError, DomainErrorStatus } from '@src/common';

class InvalidFeeRateError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}
export { InvalidFeeRateError };
