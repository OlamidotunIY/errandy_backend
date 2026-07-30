export class DuplicateApplicationError extends Error {
  constructor(errandId: string, workerId: string) {
    super(
      `Application for worker with id - ${workerId} already exist on errand with id - ${errandId}`,
    );
    this.name = DuplicateApplicationError.name;
  }
}
