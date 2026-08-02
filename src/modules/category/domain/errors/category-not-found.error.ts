import { DomainError, DomainErrorStatus } from '@src/common';

export class CategoryNotFoundError extends DomainError {
  constructor(categoryId: string) {
    super(`Category with id - ${categoryId} was not found in our system`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
