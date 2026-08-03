declare module '@paystack/paystack-sdk' {
  interface PaystackApiResponse<T = object> {
    status?: boolean;
    message?: string;
    data?: T;
  }

  interface PaystackTransactionApi {
    initialize(params: {
      email: string;
      amount: number;
      currency?: string;
      reference?: string;
      callback_url?: string;
      metadata?: string;
    }): Promise<PaystackApiResponse>;

    verify(params: { reference: string }): Promise<PaystackApiResponse>;

    chargeAuthorization(params: {
      email: string;
      amount: number;
      authorization_code: string;
      reference?: string;
      currency?: string;
    }): Promise<PaystackApiResponse>;

    list(params: {
      perPage?: number;
      page?: number;
      from?: string;
      to?: string;
      customer?: string;
      status?: string;
      amount?: string;
    }): Promise<PaystackApiResponse>;
  }

  interface PaystackRefundApi {
    create(params: {
      transaction: string;
      amount?: number;
      currency?: string;
      customer_note?: string;
      merchant_note?: string;
    }): Promise<PaystackApiResponse>;
  }

  export class Paystack {
    constructor(secretKey: string);

    transaction: PaystackTransactionApi;
    refund: PaystackRefundApi;
  }
}
