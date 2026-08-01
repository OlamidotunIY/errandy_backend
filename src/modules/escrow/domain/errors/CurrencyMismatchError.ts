import { DomainError, DomainErrorStatus } from '@src/common';
import { Currency } from '../value-objects';

class CurrencyMismatchError extends DomainError {
  constructor(currency1: Currency, currency2: Currency) {
    super(`Cannot mix currencies: ${currency1} and ${currency2}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}

export { CurrencyMismatchError };
