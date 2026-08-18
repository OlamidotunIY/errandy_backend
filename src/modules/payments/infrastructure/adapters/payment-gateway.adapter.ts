import { Inject, Injectable } from '@nestjs/common';
import { Paystack } from '@paystack/paystack-sdk';
import {
  ChargeResult,
  IPaymentGatewayAdapter,
  PaymentAuthorization,
  PaystackAuthenticationError,
  RefundResult,
} from '@src/modules';
import { PAYMENT_PROVIDER } from '@src/infrastructure/payment-provider';

@Injectable()
export class PaymentGatewayAdapter implements IPaymentGatewayAdapter {
  constructor(
    @Inject(PAYMENT_PROVIDER)
    private readonly paystack: Paystack,
  ) {}

  async verifyTransaction(reference: string): Promise<PaymentAuthorization> {
    const response = await this.paystack.transaction.verify({ reference });

    if (!response.status) {
      throw new PaystackAuthenticationError(
        response.message ?? 'Verification failed',
      );
    }

    const data = response.data as Record<string, unknown>;
    const auth = data?.authorization as Record<string, unknown> | undefined;

    return {
      providerRef: (auth?.authorization_code as string) ?? '',
      cardBrand: auth?.card_type as string | undefined,
      last4: auth?.last4 as string | undefined,
      expMonth: auth?.exp_month ? Number(auth.exp_month) : undefined,
      expYear: auth?.exp_year ? Number(auth.exp_year) : undefined,
    };
  }

  async chargeAuthorization(
    email: string,
    providerRef: string,
    amountMinorUnits: number,
    currency: string,
    reference: string,
  ): Promise<ChargeResult> {
    const response = await this.paystack.transaction.chargeAuthorization({
      email,
      amount: amountMinorUnits,
      authorization_code: providerRef,
      reference,
      currency,
    });

    return {
      success: response.status ?? false,
      gatewayReference:
        ((response.data as Record<string, unknown>)?.reference as string) ??
        reference,
      failureReason: response.status ? undefined : response.message,
    };
  }

  async refund(
    gatewayReference: string,
    amountMinorUnits?: number,
  ): Promise<RefundResult> {
    const response = await this.paystack.refund.create({
      transaction: gatewayReference,
      ...(amountMinorUnits != null && { amount: amountMinorUnits }),
    });

    return {
      success: response.status ?? false,
      failureReason: response.status ? undefined : response.message,
    };
  }
}
