import { EscrowId } from '../../../domain';

export interface ReleaseEscrowPayload {
  escrowId: EscrowId;
  correlationId: string;
}
