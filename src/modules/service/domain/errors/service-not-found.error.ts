import { DomainError, DomainErrorStatus } from '@src/common';

export class ServiceNotFoundError extends DomainError {
  constructor(serviceId: string) {
    super(`Service with id - ${serviceId} was not found in our system`, {
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
