export interface PaymentGateway {
  /**
   * Initializes a payment transaction
   * @param email Customer's email
   * @param amount Amount in smallest currency unit (e.g. kobo)
   * @param callbackUrl URL to redirect after payment
   * @param metadata Additional metadata
   */
  initializeTransaction(
    email: string,
    amount: number,
    callbackUrl: string,
    metadata?: any,
  ): Promise<any>;

  /**
   * Verifies a payment transaction
   * @param reference Transaction reference
   */
  verifyTransaction(reference: string): Promise<any>;

  /**
   * Initiates a refund for a transaction
   * @param transactionOrReference Transaction ID or Reference
   * @param amount Amount to refund in smallest currency unit
   */
  refundTransaction(
    transactionOrReference: string,
    amount: number,
  ): Promise<any>;

  /**
   * Retries a failed refund with customer details
   * @param refundId Refund ID/Reference to retry
   * @param accountDetails Account details for the refund
   */
  retryRefund(refundId: string, accountDetails: any): Promise<any>;

  /**
   * Charges a saved authorization (e.g. Paystack authorization_code).
   * Must be idempotent for the provided key to avoid double-charging on retries.
   *
   * @param email Customer email
   * @param amount Amount in smallest currency unit (e.g. kobo)
   * @param authorizationCode Provider reference for the saved payment method
   * @param idempotencyKey Idempotency key for safe retries
   * @param metadata Additional metadata (optional)
   */
  charge(
    email: string,
    amount: number,
    authorizationCode: string,
    idempotencyKey: string,
    metadata?: any,
  ): Promise<any>;
}
