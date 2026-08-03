import { PaymentMethod } from '../entities';

export abstract class IPaymentMethodRepository {
  abstract save(method: PaymentMethod): Promise<void>;
  abstract findById(id: string): Promise<PaymentMethod | null>;
  abstract findByPartyId(partyId: string): Promise<PaymentMethod[]>;
  abstract findDefaultByPartyId(partyId: string): Promise<PaymentMethod | null>;
}
