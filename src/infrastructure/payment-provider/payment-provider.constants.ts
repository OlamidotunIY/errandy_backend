/**
 * Injection token for the payment provider SDK instance.
 *
 * Any service that needs the underlying payment gateway SDK (currently Paystack)
 * should inject this token rather than instantiating the SDK directly.
 *
 * @example
 * ```ts
 * constructor(@Inject(PAYMENT_PROVIDER) private readonly paymentSdk: Paystack) {}
 * ```
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
