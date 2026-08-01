import { DomainError, DomainErrorStatus } from '@src/common';

export class ServiceNotOwnedByListerError extends DomainError {
  constructor(serviceId: string, partyId: string) {
    super(`Service with id - ${serviceId} is not owned by party - ${partyId}`, {
      statusCode: DomainErrorStatus.UNPROCESSABLE_ENTITY,
    });
  }
}
