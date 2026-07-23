export class DuplicateLedgerEntryError extends Error {
  constructor(escrowId: string, type: string) {
    super(`A ${type} ledger entry already exists for escrow ${escrowId}`);
  }
}
