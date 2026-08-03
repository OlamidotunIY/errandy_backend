export interface PaymentAuthorization {
  providerRef: string;
  cardBrand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

export interface ChargeResult {
  success: boolean;
  gatewayReference: string;
  failureReason?: string;
}

export interface RefundResult {
  success: boolean;
  failureReason?: string;
}

/**
 * Abstraction over the payment gateway in use. Paystack is the only
 * implementation today, but new providers (Stripe, Flutterwave, etc.) can be
 * added later by implementing this interface and swapping the DI binding —
 * nothing in the application layer depends on Paystack directly.
 */
export abstract class IPaymentGatewayAdapter {
  abstract verifyTransaction(reference: string): Promise<PaymentAuthorization>;

  abstract chargeAuthorization(
    email: string,
    providerRef: string,
    amountMinorUnits: number,
    currency: string,
    reference: string,
  ): Promise<ChargeResult>;

  abstract refund(
    gatewayReference: string,
    amountMinorUnits?: number,
  ): Promise<RefundResult>;
}
