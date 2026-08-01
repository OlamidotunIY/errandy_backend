import { DomainError, DomainErrorStatus } from '@src/common';

export class ProviderRoleNotFoundError extends DomainError {
  constructor(partyId: string) {
    super(`Provider role not found for party ${partyId}`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
