import { DomainError, DomainErrorStatus } from '@src/common';

export class ApplicationInvariantError extends DomainError {
  constructor(message?: string) {
    super(message ?? 'Application invariant failed', {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
