import { DomainError, DomainErrorStatus } from '@src/common';

export class UnsupportedCurrencyError extends DomainError {
  constructor(currency: string) {
    super(`Unsupported currency: ${currency}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
