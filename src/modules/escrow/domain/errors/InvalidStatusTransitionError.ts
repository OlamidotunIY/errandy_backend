import { EscrowStatus } from '../value-objects';

class InvalidStatusTransitionError extends Error {
  constructor(from: EscrowStatus, to: EscrowStatus) {
    super(`Cannot transition escrow from ${from} to ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export { InvalidStatusTransitionError };
