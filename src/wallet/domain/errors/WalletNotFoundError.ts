class WalletNotFoundError extends Error {
  constructor(walletId: string) {
    super(`Wallet with ID ${walletId} not found`);
    this.name = 'WalletNotFoundError';
  }
}

export { WalletNotFoundError };
