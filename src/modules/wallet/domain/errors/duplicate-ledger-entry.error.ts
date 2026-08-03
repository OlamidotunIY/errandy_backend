import { DomainError, DomainErrorStatus } from '@src/common';

export class DuplicateLedgerEntryError extends DomainError {
  constructor(idempotencyKey: string) {
    super(
      `A ledger entry with idempotency key ${idempotencyKey} already exists`,
      { statusCode: DomainErrorStatus.CONFLICT },
    );
  }
}
