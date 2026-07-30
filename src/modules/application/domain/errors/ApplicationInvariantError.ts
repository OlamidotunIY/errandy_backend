export class ApplicationInvariantError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ApplicationInvariantError';
  }
}
