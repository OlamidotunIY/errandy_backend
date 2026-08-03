import { DomainError, DomainErrorStatus } from '@src/common';

export class InvariantTransactionError extends DomainError {
  constructor(message: string) {
    super(message, {
      statusCode: DomainErrorStatus.BAD_REQUEST,
    });
  }
}
