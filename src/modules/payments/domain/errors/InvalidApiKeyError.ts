export class InvalidApiKeyError extends Error {
  constructor() {
    super('Paystack API key is missing or malformed in configuration');
    this.name = 'InvalidApiKeyError';
  }
}
