import { EscrowId } from '@module/escrow/domain';

export interface MarkEscrowCompletedPayload {
  escrowId: EscrowId;
  completedAt: Date;
  correlationId: string;
}
