import { DomainError, DomainErrorStatus } from '@src/common';

export class ClientRoleNotFoundError extends DomainError {
  constructor(partyId: string) {
    super(`Client role not found for party ${partyId}`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
