class InsufficientPendingBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientPendingBalanceError';
  }
}

export { InsufficientPendingBalanceError };
