declare module '@paystack/paystack-sdk' {
  export class Paystack {
    constructor(secretKey: string);

    transactions: {
      list(params: {
        page?: number;
        perPage?: number;
        from?: string;
        to?: string;
        customer?: string;
        status?: string;
        amount?: string;
      }): Promise<PaystackTransactionType>;
    };
  }
}
