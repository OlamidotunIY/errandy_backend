import { EscrowId, RefundReason } from '@module/escrow/domain';

export class RefundEscrowCommand {
  constructor(
    public readonly payload: {
      escrowId: EscrowId;
      reason: RefundReason;
      correlationId?: string;
    },
  ) {}
}
