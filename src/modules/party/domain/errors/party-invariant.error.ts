import { DomainError, DomainErrorStatus } from '@src/common';

export class PartyInvariantError extends DomainError {
  constructor(message: string) {
    super(message, { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY });
  }
}
