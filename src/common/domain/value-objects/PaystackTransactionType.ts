export interface PaystackTransactionType {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    currency: string;
    fees: number;
    customer: {
      email: string;
      customer_code: string;
    };
    authorization: {
      authorization_code: string;
      last4: string;
      brand: string;
      bank: string;
    };
  }[];
  meta: {
    next: string | null;
    previous: string | null;
    perPage: number;
  };
}
