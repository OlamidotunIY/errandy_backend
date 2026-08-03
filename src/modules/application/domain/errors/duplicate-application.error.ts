import { DomainError, DomainErrorStatus } from '@src/common';

export class DuplicateApplicationError extends DomainError {
  constructor(errandId: string, providerPartyId: string) {
    super(
      `Application for worker with id - ${providerPartyId} already exist on errand with id - ${errandId}`,
      { statusCode: DomainErrorStatus.CONFLICT },
    );
  }
}
