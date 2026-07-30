import { ClientId } from '@module/clients';
import { EscrowId, Money } from '@module/escrow/domain';
import { PaymentMethodId } from '@module/payments';
import { ProviderId } from '@module/providers';

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
