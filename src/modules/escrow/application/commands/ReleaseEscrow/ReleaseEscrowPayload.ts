import { EscrowId } from 'src/modules/escrow/domain';

export interface ReleaseEscrowPayload {
  escrowId: EscrowId;
  correlationId: string;
}
