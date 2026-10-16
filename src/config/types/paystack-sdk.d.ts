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

  interface PaystackTransferRecipientApi {
    create(params: {
      type: string;
      name: string;
      account_number: string;
      bank_code: string;
      currency?: string;
      description?: string;
      authorization_code?: string;
      metadata?: Record<string, unknown>;
    }): Promise<PaystackApiResponse>;
  }

  interface PaystackTransferApi {
    initiate(params: {
      source: string;
      amount: number;
      recipient: string;
      reason?: string;
      currency?: string;
      reference?: string;
    }): Promise<PaystackApiResponse>;
  }

  export class Paystack {
    constructor(secretKey: string);

    transaction: PaystackTransactionApi;
    refund: PaystackRefundApi;
    transferrecipient: PaystackTransferRecipientApi;
    transfer: PaystackTransferApi;
  }
}
