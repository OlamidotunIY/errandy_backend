import { DomainError, DomainErrorStatus } from '../domain-error';

/**
 * Thrown when a module cannot resolve an entity owned by another module
 * through a read port. The code mirrors the former module-specific errors
 * (e.g. `PartyNotFoundError`) so API consumers keep seeing the same codes.
 */
export class ReferenceNotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} with id - ${id} was not found in our system`, {
      code: `${entity}NotFoundError`,
      statusCode: DomainErrorStatus.NOT_FOUND,
    });
  }
}
