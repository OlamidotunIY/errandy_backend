import { EscrowId } from '../../domain';

export interface ReleaseMaturedEscrowsPayload {
  id: EscrowId;
  correlationId: string;
}
