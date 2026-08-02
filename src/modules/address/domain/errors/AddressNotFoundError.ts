import { DomainError, DomainErrorStatus } from '@src/common';

export class AddressNotFoundError extends DomainError {
  constructor(addressId: string) {
    super(`Address with id - ${addressId} was not found in our system`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
