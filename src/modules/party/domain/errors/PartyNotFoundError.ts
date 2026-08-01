import { DomainError, DomainErrorStatus } from '@src/common';

export class PartyNotFoundError extends DomainError {
  constructor(partyId: string) {
    super(`Party with id - ${partyId} was not found in our system`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
