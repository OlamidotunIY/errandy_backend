class InvalidLedgerAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLedgerAmountError';
  }
}

export { InvalidLedgerAmountError };
