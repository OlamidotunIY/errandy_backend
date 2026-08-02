import { DomainError, DomainErrorStatus } from '@src/common';

export class InvalidApiKeyError extends DomainError {
  constructor() {
    super('Paystack API key is missing or malformed in configuration', {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
