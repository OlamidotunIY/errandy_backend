import { DomainError, DomainErrorStatus } from '@src/common';

export class PersonPartyAlreadyExistsError extends DomainError {
  constructor(userId: string) {
    super(`Person party already exists for user ${userId}`, {
      statusCode: DomainErrorStatus.CONFLICT,
    });
  }
}
