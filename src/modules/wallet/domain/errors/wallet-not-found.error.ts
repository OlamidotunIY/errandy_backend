import { DomainError, DomainErrorStatus } from '@src/common';

class WalletNotFoundError extends DomainError {
  constructor() {
    super('Wallet not found', { statusCode: DomainErrorStatus.NOT_FOUND });
  }
}

export { WalletNotFoundError };
