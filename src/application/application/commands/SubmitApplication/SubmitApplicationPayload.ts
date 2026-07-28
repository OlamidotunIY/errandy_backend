import { ErrandId } from '@errands';
import { ProviderId } from '@provider';

export interface SubmitApplicationPayload {
  errandId: ErrandId;
  workerId: ProviderId;
  proposal: string;
  proposedAmountKobo: number;
  currency: string;
}
