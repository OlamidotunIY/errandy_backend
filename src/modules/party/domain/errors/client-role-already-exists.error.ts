import { DomainError, DomainErrorStatus } from '@src/common';

export class ClientRoleAlreadyExistsError extends DomainError {
  constructor(partyId: string) {
    super(`Client role already exists for party ${partyId}`, {
      statusCode: DomainErrorStatus.CONFLICT,
    });
  }
}
