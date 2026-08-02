import { DomainError, DomainErrorStatus } from '@src/common';

export class ProviderRoleAlreadyExistsError extends DomainError {
  constructor(partyId: string) {
    super(`Provider role already exists for party ${partyId}`, {
      statusCode: DomainErrorStatus.CONFLICT,
    });
  }
}
