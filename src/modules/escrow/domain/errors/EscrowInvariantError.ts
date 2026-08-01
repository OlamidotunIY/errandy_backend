export class EscrowInvariantError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'EscrowInvariantError';
  }
}
