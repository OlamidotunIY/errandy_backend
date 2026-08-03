import { DomainError, DomainErrorStatus } from '@src/common';

export class OrganizationNotFoundError extends DomainError {
  constructor(partyId: string) {
    super(`Organization details not found for party ${partyId}`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
