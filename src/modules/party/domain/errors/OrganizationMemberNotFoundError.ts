import { DomainError, DomainErrorStatus } from '@src/common';

export class OrganizationMemberNotFoundError extends DomainError {
  constructor(userId: string) {
    super(`Organization member not found for user ${userId}`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
