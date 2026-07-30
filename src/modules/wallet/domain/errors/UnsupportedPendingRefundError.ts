class UnsupportedPendingRefundError extends Error {
  constructor() {
    super('Pending refunds are not supported for this wallet');
    this.name = 'UnsupportedPendingRefundError';
  }
}

export { UnsupportedPendingRefundError };
