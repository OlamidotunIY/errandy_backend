import { Currency } from '../value-objects';

class CurrencyMismatchError extends Error {
  constructor(currency1: Currency, currency2: Currency) {
    super(`Cannot mix currencies: ${currency1} and ${currency2}`);
    this.name = 'CurrencyMismatchError';
  }
}

export { CurrencyMismatchError };
