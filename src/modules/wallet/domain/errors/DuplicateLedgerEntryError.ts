export class DuplicateLedgerEntryError extends Error {
  constructor(idempotencyKey: string) {
    super(
      `A ledger entry with idempotency key ${idempotencyKey} already exists`,
    );
  }
}
