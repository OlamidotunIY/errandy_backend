import { DomainError, DomainErrorStatus } from '@src/common';

export class CategoryNotLeafError extends DomainError {
  constructor(categoryId: string) {
    super(
      `Category with id - ${categoryId} is not a leaf category and cannot be assigned directly`,
      { statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY },
    );
  }
}
