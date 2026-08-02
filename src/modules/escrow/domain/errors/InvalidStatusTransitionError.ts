import { DomainError, DomainErrorStatus } from '@src/common';
import { EscrowStatus } from '../value-objects';

class InvalidStatusTransitionError extends DomainError {
  constructor(from: EscrowStatus, to: EscrowStatus) {
    super(`Cannot transition escrow from ${from} to ${to}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}

export { InvalidStatusTransitionError };
