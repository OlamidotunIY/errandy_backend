import { EscrowId } from 'src/modules/escrow/domain';

export interface MarkEscrowCompletedPayload {
  escrowId: EscrowId;
  completedAt: Date;
  correlationId: string;
}
