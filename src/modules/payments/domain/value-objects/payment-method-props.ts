import { PaymentMethodId, PaymentMethodType } from './';

export interface PaymentMethodProps {
  id: PaymentMethodId;
  partyId: string;
  provider: string;
  providerRef: string;
  type: PaymentMethodType;
  cardBrand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  verified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
