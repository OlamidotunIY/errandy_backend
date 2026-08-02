import { DomainError, DomainErrorStatus } from '@src/common';

export class PaystackAuthenticationError extends DomainError {
  constructor(public readonly paystackErrorMessage: string) {
    super(`Paystack authentication failed: ${paystackErrorMessage}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
