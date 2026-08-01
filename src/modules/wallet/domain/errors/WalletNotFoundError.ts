class WalletNotFoundError extends Error {
  constructor() {
    super(`Wallet not found`);
    this.name = 'WalletNotFoundError';
  }
}

export { WalletNotFoundError };
