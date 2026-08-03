import { DomainError, DomainErrorStatus } from '@src/common';

export class RefundFailedError extends DomainError {
  constructor(reason: string) {
    super(`Refund failed: ${reason}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
