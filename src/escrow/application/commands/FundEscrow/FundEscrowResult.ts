import { EscrowId, Money } from '@escrow';

interface FundEscrowResult {
  escrowId: EscrowId;
  amountGross: Money;
  platformFee: Money;
  amountNetWorker: Money;
}

export { FundEscrowResult };
