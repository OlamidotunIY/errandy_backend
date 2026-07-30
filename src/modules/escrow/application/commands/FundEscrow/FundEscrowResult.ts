import { EscrowId, Money } from 'src/modules/escrow';
import { ClientId } from '@client';
import { ProviderId } from '@provider';
import { PaymentMethodId } from '@payments';

interface FundEscrowResult {
  escrowId: string;
  amountGross: number;
  platformFee: number;
  amountNetWorker: number;
}

interface FundEscrowPayload {
  errandId: EscrowId;
  clientId: ClientId;
  workerId: ProviderId;
  amountGross: Money;
  paymentMethodId: PaymentMethodId;
  platformFeeRate: number;
  correlationId: string;
}

export { FundEscrowResult, FundEscrowPayload };
