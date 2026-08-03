import { DomainError, DomainErrorStatus } from '@src/common';

export class EscrowInvariantError extends DomainError {
  constructor(message?: string) {
    super(message ?? 'Escrow invariant failed', {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
