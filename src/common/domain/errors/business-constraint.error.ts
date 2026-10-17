import { DomainError, DomainErrorStatus } from '../domain-error';

export class CategoryNotLeafError extends DomainError {
  constructor(categoryId: string) {
    super(
      `Category with id - ${categoryId} is not a leaf category and cannot be assigned directly`,
      { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY },
    );
  }
}

export class CategoryTierMismatchError extends DomainError {
  constructor(partyId: string, categoryId: string) {
    super(
      `Party ${partyId} does not meet the required tier for category ${categoryId}`,
      { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY },
    );
  }
}

export class ProviderRoleNotFoundError extends DomainError {
  constructor(partyId: string) {
    super(`Provider role not found for party ${partyId}`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
