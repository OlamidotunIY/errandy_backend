export class UnsupportedCurrencyError extends Error {
  constructor(currency: string) {
    super(`Unsupported currency: ${currency}`);
  }
}
