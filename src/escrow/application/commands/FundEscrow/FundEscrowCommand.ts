import { ErrandId } from '@errands';
import { ClientId } from '@client';
import { ProviderId } from '@provider';
import { Money } from '@escrow';
import { PaymentMethodId } from '@payments';

interface FundEscrowCommand {
  errandId: ErrandId;
  clientId: ClientId;
  workerId: ProviderId;
  amountGross: Money;
  paymentMethodId: PaymentMethodId;
  platformFeeRate: number;
}

export { FundEscrowCommand };
