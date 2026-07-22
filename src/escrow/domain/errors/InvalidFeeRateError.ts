class InvalidFeeRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFeeRateError';
  }
}