export class ApplicationNotFoundError extends Error {
  constructor(applicationId: string) {
    super(`Application with id - ${applicationId} was not found in our system`);
    this.name = ApplicationNotFoundError.name;
  }
}
