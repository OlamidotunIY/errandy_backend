import { EscrowId } from 'src/modules/escrow/domain';

export interface ReleaseMaturedEscrowsPayload {
  id: EscrowId;
  correlationId: string;
}
