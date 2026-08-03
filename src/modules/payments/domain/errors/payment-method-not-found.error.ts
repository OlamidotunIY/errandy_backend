import { DomainError, DomainErrorStatus } from '@src/common';

export class PaymentMethodNotFoundError extends DomainError {
  constructor(paymentMethodId: string) {
    super(`Payment method with id - ${paymentMethodId} was not found`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
