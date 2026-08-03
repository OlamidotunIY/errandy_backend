import { PaymentTransaction } from '../';

export abstract class IPaymentTransactionRepository {
  abstract save(transaction: PaymentTransaction): Promise<void>;
  abstract findById(id: string): Promise<PaymentTransaction | null>;
  abstract findByGatewayReference(
    reference: string,
  ): Promise<PaymentTransaction | null>;
  abstract findByPurposeId(
    purposeId: string,
  ): Promise<PaymentTransaction | null>;
}
