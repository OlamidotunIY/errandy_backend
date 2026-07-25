import { EscrowId } from '@escrow/domain';

export interface MarkEscrowCompletedPayload {
  escrowId: EscrowId;
  completedAt: Date;
  correlationId: string;
}
