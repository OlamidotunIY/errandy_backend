import { EscrowId } from '@escrow/domain';

export interface ReleaseMaturedEscrowsPayload {
  id: EscrowId;
  correlationId: string;
}
