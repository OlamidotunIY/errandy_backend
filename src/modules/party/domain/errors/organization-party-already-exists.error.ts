import { DomainError, DomainErrorStatus } from '@src/common';

export class OrganizationPartyAlreadyExistsError extends DomainError {
  constructor(ownerId: string, businessRegistrationNumber: string) {
    super(
      `Organization party already exists for owner ${ownerId} and registration ${businessRegistrationNumber}`,
      {
        statusCode: DomainErrorStatus.CONFLICT,
      },
    );
  }
}
