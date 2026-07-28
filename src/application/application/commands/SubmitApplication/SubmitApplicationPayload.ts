import { ErrandId } from '@errands';
import { ProviderId } from '@provider';
import { ApplicationType } from '@application/domain';

export interface SubmitApplicationPayload {
  errandId: ErrandId;
  workerId: ProviderId;
  proposal: string;
  proposedAmountKobo: number;
  currency: string;
  applicantType: ApplicationType;
}
