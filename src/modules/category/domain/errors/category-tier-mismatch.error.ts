import { DomainError, DomainErrorStatus } from '@src/common';

export class CategoryTierMismatchError extends DomainError {
  constructor(partyId: string, categoryId: string) {
    super(
      `Party ${partyId} does not meet the required tier for category ${categoryId}`,
      { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY },
    );
  }
}
