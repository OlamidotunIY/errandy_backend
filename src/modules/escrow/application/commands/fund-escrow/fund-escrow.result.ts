import { PartyId } from '@module/party';
import { EscrowId, Money } from '@module/escrow/domain';
import { PaymentMethodId } from '@module/payments';

interface FundEscrowResult {
  escrowId: string;
  amountGross: number;
  platformFee: number;
  amountNetWorker: number;
}

interface FundEscrowPayload {
  errandId: EscrowId;
  clientId: PartyId;
  workerId: PartyId;
  amountGross: Money;
  paymentMethodId: PaymentMethodId;
  platformFeeRate: number;
  correlationId: string;
}

export { FundEscrowResult, FundEscrowPayload };
