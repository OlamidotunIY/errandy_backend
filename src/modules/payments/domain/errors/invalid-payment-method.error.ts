import { DomainError, DomainErrorStatus } from '@src/common';

export class InvalidPaymentMethodError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}
