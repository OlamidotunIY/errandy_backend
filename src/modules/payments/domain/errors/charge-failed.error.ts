import { DomainError, DomainErrorStatus } from '@src/common';

export class ChargeFailedError extends DomainError {
  constructor(reason: string) {
    super(`Charge failed: ${reason}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
