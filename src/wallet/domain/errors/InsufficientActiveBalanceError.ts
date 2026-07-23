class InsufficientActiveBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientActiveBalanceError';
  }
}

export { InsufficientActiveBalanceError };
