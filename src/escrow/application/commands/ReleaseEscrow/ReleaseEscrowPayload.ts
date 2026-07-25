import { EscrowId } from '@escrow/domain';

export interface ReleaseEscrowPayload {
  escrowId: EscrowId;
  correlationId: string;
}
