export class PaystackAuthenticationError extends Error {
  constructor(public readonly paystackErrorMessage: string) {
    super(`Paystack authentication failed: ${paystackErrorMessage}`);
    this.name = 'PaystackAuthenticationError';
  }
}
