import { DomainError, DomainErrorStatus } from '@src/common';

export class OrganizationMemberAlreadyExistsError extends DomainError {
  constructor(userId: string) {
    super(`Organization member already exists for user ${userId}`, {
      statusCode: DomainErrorStatus.CONFLICT,
    });
  }
}
